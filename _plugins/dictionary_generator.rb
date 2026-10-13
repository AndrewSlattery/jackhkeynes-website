require 'json'
require 'fileutils'

module Jekyll
  class DictionaryGenerator < Generator
    safe true
    priority :high

    def generate(site)
      # --- CONFIGURATION ---
      config = site.config['dictionary_generator'] || {}

      # Input: The .db file in your submodule
      db_relative_path = config['db_path'] || "_data/external_dictionary/Borlish/Lexique Pro/Data/Borlish.db"
      db_path = File.join(site.source, db_relative_path)

      # Output: Where you want the JSON file to appear
      output_relative_path = config['output_path'] || "assets/boralverse/borlish-dictionary.json"
      output_file = File.join(site.source, output_relative_path)
      output_dir = File.dirname(output_file)
      # ---------------------

      if File.exist?(db_path)
        puts "   Dictionary: Found DB at #{db_relative_path}. Processing..."

        # Optimization: Try to load from cache if up-to-date
        source_mtime = [File.mtime(db_path), File.mtime(__FILE__)].max
        if File.exist?(output_file) && File.mtime(output_file) >= source_mtime
          begin
            data = JSON.parse(File.read(output_file))
            site.data['boralverse'] = data
            puts "   Dictionary: Loaded from cache #{output_file}. Skipping regeneration."
            return
          rescue JSON::ParserError
            puts "   Dictionary: Cache corrupted. Regenerating."
            File.delete(output_file) if File.exist?(output_file)
          end
        end
        
        # 1. Parse the Database
        data = parse_mdf(db_path)
        
        # 2. Ensure the output directory exists
        FileUtils.mkdir_p(output_dir)

        # 3. Write the JSON file to disk
        new_content = JSON.pretty_generate(data)
        
        # Check if file exists and content is different
        should_write = true
        if File.exist?(output_file)
          source_mtime = [File.mtime(db_path), File.mtime(__FILE__)].max
          output_mtime = File.mtime(output_file)

          # Optimization: Check mtime and size first to avoid reading file
          if output_mtime >= source_mtime && File.size(output_file) == new_content.bytesize
            should_write = false
            puts "   Dictionary: No changes detected (mtime/size match). Skipping write."
          elsif File.size(output_file) == new_content.bytesize && File.read(output_file) == new_content
            should_write = false
            FileUtils.touch(output_file)
            puts "   Dictionary: No changes detected. Touched file to update mtime."
          end
        end

        if should_write
          File.write(output_file, new_content)
          puts "   Dictionary: Generated #{output_file} with #{data.length} entries."
        end
        
        # 4. Also make it available to Liquid
        site.data['boralverse'] = data
      else
        puts "   Dictionary: WARN - Could not find database at #{db_path}"
      end
    end

    # Output shape (keys are omitted when empty):
    #
    #   { "lx": "a tug", "hm": "1",
    #     "senses": [ { "ps": "adv", "ue": [...], "uv": [...], "ge": [...],
    #                   "de": [...], "dv": [...],
    #                   "examples": [ { "vernacular": "...", "english": "..." } ] } ],
    #     "et": "paragraph one\n\nparagraph two",
    #     "mn": [...], "sd": [...],
    #     "subentries": [ { "lx": "...", "senses": [...], "et": "...", "mn": [...] } ] }
    #
    # Each \ps starts a new sense; sense-level markers attach to the current
    # sense. \se starts a subentry, which collects everything up to the next
    # \se or \lx. Any other marker is kept on the current entry/subentry as a list.
    SENSE_MARKERS = %w[ge ue uv de dv].freeze
    KNOWN_MARKERS = (%w[lx se ps xv xe hm et mn sd] + SENSE_MARKERS).freeze

    def parse_mdf(file_path)
      build_entries(read_fields(file_path))
    end

    # Splits the file into [marker, value] pairs. Lines that don't start with a
    # marker continue the previous field; blank lines within a field separate
    # paragraphs, which are joined with "\n\n".
    def read_fields(file_path)
      fields = []
      File.foreach(file_path, encoding: 'bom|utf-8') do |line|
        line = line.strip
        if line =~ /\A\\(\w+)\s*(.*)\z/
          fields << [$1, [$2]]
        elsif fields.any?
          fields.last[1] << line
        end
      end
      fields.map { |marker, lines| [marker, join_paragraphs(lines)] }
    end

    def join_paragraphs(lines)
      paragraphs = [[]]
      lines.each do |line|
        if line.empty?
          paragraphs << [] unless paragraphs.last.empty?
        else
          paragraphs.last << line
        end
      end
      paragraphs.reject(&:empty?).map { |p| p.join(' ') }.join("\n\n")
    end

    def build_entries(fields)
      entries = []
      @unknown_markers = Hash.new(0)
      entry = record = sense = example = nil

      fields.each do |marker, value|
        # Skip header lines (Lexique Pro metadata) and empty fields
        next if marker.start_with?('_') || value.empty?

        if marker == 'lx'
          entry = record = { "lx" => value }
          entries << entry
          sense = example = nil
          next
        end
        next unless entry

        case marker
        when 'se'
          record = { "lx" => value }
          (entry["subentries"] ||= []) << record
          sense = example = nil
        when 'ps'
          sense = new_sense(record) unless sense && !sense.key?("ps")
          sense["ps"] = value
          example = nil
        when 'xv'
          sense ||= new_sense(record)
          example = { "vernacular" => value }
          (sense["examples"] ||= []) << example
        when 'xe'
          sense ||= new_sense(record)
          if example
            example["english"] = value
          else
            # Edge case: Translation without a sentence
            (sense["examples"] ||= []) << { "english" => value }
          end
          example = nil
        when *SENSE_MARKERS
          sense ||= new_sense(record)
          (sense[marker] ||= []) << value
        when 'hm'
          record["hm"] = value
        when 'et'
          record["et"] = [record["et"], value].compact.join("\n\n")
        else
          @unknown_markers[marker] += 1 unless KNOWN_MARKERS.include?(marker)
          (record[marker] ||= []) << value
        end
      end

      unless @unknown_markers.empty?
        list = @unknown_markers.map { |m, n| "\\#{m} (#{n})" }.join(', ')
        puts "   Dictionary: NOTE - markers with no special handling (kept as lists): #{list}"
      end

      entries
    end

    def new_sense(record)
      sense = {}
      (record["senses"] ||= []) << sense
      sense
    end
  end
end