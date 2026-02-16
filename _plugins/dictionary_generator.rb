require 'json'
require 'fileutils'

module Jekyll
  class DictionaryGenerator < Generator
    safe true
    priority :high

    def generate(site)
      # --- CONFIGURATION ---
      # Input: The .db file in your submodule
      db_relative_path = "_data/external_dictionary/Borlish/Lexique Pro/Data/Borlish.db"
      db_path = File.join(site.source, db_relative_path)

      # Output: Where you want the JSON file to appear
      output_dir = File.join(site.source, "assets", "boralverse")
      output_file = File.join(output_dir, "borlish-dictionary.json")
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

    def parse_mdf(file_path)
      entries = []
      current_entry = {}
      current_example = nil 

      File.foreach(file_path, encoding: 'UTF-8') do |line|
        line.strip!
        next if line.empty?
        
        # Skip header lines (Lexique Pro metadata)
        next if line.start_with?('\_')

        # --- A. New Entry (\lx) ---
        if line =~ /^\\lx\s+(.+)/
          # Save the previous entry if it exists
          save_entry(entries, current_entry) unless current_entry.empty?
          
          # Start a new entry object
          current_entry = { "lx" => $1.strip, "examples" => [] }
          current_example = nil

        # --- B. Example Sentence (\xv) ---
        elsif line =~ /^\\xv\s+(.+)/
          # If a previous example was incomplete (had no translation), save it anyway
          current_entry["examples"] << current_example if current_example

          # Start a new example object
          current_example = { "vernacular" => $1.strip }

        # --- C. Example Translation (\xe) ---
        elsif line =~ /^\\xe\s+(.+)/
          if current_example
            current_example["english"] = $1.strip
            # Pair complete, add to the entry
            current_entry["examples"] << current_example
            current_example = nil
          else
            # Edge case: Translation without a sentence
            current_entry["examples"] << { "english" => $1.strip }
          end

        # --- D. All Other Markers (\ge, \ps, \et, etc.) ---
        elsif line =~ /^\\(\w+)\s+(.+)/
          marker = $1
          content = $2.strip
          
          # If the marker already exists (e.g. multiple definitions), turn it into a list
          if current_entry.key?(marker)
            if current_entry[marker].is_a?(Array)
              current_entry[marker] << content
            else
              current_entry[marker] = [current_entry[marker], content]
            end
          else
            current_entry[marker] = content
          end
        end
      end
      
      # Don't forget to save the very last entry in the file
      save_entry(entries, current_entry) unless current_entry.empty?
      
      return entries
    end

    def save_entry(entries, entry)
      # Cleanup: remove the examples list if it's empty to keep JSON clean
      entry.delete("examples") if entry["examples"].empty?
      
      # Add to main list
      entries << entry
    end
  end
end