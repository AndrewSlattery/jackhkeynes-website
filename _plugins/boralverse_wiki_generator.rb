require 'json'
require 'fileutils'
require 'pathname'
require 'kramdown'

module Jekyll
  class BoralverseWikiGenerator < Generator
    safe true
    priority :high

    VAULT_RELATIVE = "_data/external_dictionary/Borlish/Obsidian/Boralverse"
    OUTPUT_RELATIVE = "assets/boralverse/boralverse-wiki.json"

    def generate(site)
      vault_dir = File.join(site.source, VAULT_RELATIVE)
      output_file = File.join(site.source, OUTPUT_RELATIVE)

      unless Dir.exist?(vault_dir)
        puts "   Boralverse Wiki: WARN - Vault not found at #{VAULT_RELATIVE}"
        return
      end

      vault_pn = Pathname.new(vault_dir)

      # Collect markdown files, skipping .obsidian and image asset folders
      md_files = Dir.glob(File.join(vault_dir, '**', '*.md')).select do |f|
        rel = Pathname.new(f).relative_path_from(vault_pn).to_s.tr('\\', '/')
        !rel.start_with?('.obsidian/') && !rel.start_with?('- Images/')
      end.sort

      puts "   Boralverse Wiki: Found #{md_files.length} markdown files"

      # Cache check: skip regeneration if output is newer than all sources
      if File.exist?(output_file)
        out_mtime = File.mtime(output_file)
        plugin_mtime = File.mtime(__FILE__)
        newest = ([plugin_mtime] + md_files.map { |f| File.mtime(f) }).max
        if newest <= out_mtime
          puts "   Boralverse Wiki: Cache up to date, skipping."
          return
        end
      end

      # First pass: collect metadata and build title→slug lookup
      raw = md_files.map { |path| extract_meta(path, vault_pn) }
      title_to_slug = raw.each_with_object({}) { |e, h| h[e[:key]] = e[:slug] }

      # Second pass: render content to HTML
      entries = raw.map do |meta|
        content = File.read(meta[:path], encoding: 'UTF-8')
        content = strip_front_matter(content)
        content = strip_block_ids(content)
        content = fix_block_spacing(content)
        content = process_wikilinks(content, title_to_slug)
        html = Kramdown::Document.new(content).to_html
        {
          'title'       => meta[:title],
          'slug'        => meta[:slug],
          'category'    => meta[:category],
          'subcategory' => meta[:subcategory],
          'html'        => html
        }
      end

      FileUtils.mkdir_p(File.dirname(output_file))
      File.write(output_file, JSON.generate(entries), encoding: 'UTF-8')
      puts "   Boralverse Wiki: Written #{OUTPUT_RELATIVE} (#{entries.length} entries)"
    end

    private

    def extract_meta(path, vault_pn)
      rel   = Pathname.new(path).relative_path_from(vault_pn).to_s.tr('\\', '/')
      parts = rel.split('/')
      title = File.basename(parts.last, '.md')
      cat   = parts.length > 1 ? parts[0] : ''
      sub   = parts.length > 2 ? parts[1..-2].join('/') : nil
      { title: title, slug: slugify(title), key: title.downcase, category: cat, subcategory: sub, path: path }
    end

    # Remove YAML front matter (used by some Obsidian plugins, e.g. Fantasy Calendar)
    def strip_front_matter(text)
      text.sub(/\A---\r?\n.*?---\r?\n?/m, '')
    end

    # Ensure block-level elements (headings, bullet lists, ordered lists) that
    # follow a non-blank line are preceded by a blank line — Kramdown requires
    # this gap to recognise them as distinct block elements.
    #
    # Rules:
    #   • Headings always get a blank line before them if the previous line is
    #     non-blank (headings can follow list items, prose, or other headings).
    #   • List items get a blank line before them only when the previous line is
    #     not itself a list item (so consecutive list items stay together).
    def fix_block_spacing(text)
      lines = text.split("\n", -1)
      result = []
      lines.each_with_index do |line, _i|
        prev         = result.last.to_s
        prev_blank   = prev.empty? || prev.match?(/\A[ \t]*$/)
        is_heading   = line.match?(/\A\#{1,6} /)
        is_list_item = line.match?(/\A[ \t]*[-*+] /) || line.match?(/\A[ \t]*\d+\. /)
        prev_is_list = prev.match?(/\A[ \t]*[-*+] /) || prev.match?(/\A[ \t]*\d+\. /)

        unless prev_blank
          if is_heading
            result << ''                          # headings always need a gap
          elsif is_list_item && !prev_is_list
            result << ''                          # list after prose needs a gap
          end
        end
        result << line
      end
      result.join("\n")
    end

    # Remove Obsidian block ID markers (^abcdef at end of line)
    def strip_block_ids(text)
      text.gsub(/[ \t]*\^[a-zA-Z0-9]+[ \t]*(\n|$)/, "\n")
    end

    def process_wikilinks(text, title_to_slug)
      # Split on fenced code blocks and inline code to avoid touching code content
      parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/)
      parts.each_with_index.map do |part, i|
        i.even? ? resolve_links(part, title_to_slug) : part
      end.join
    end

    def resolve_links(text, title_to_slug)
      # [[target#anchor|display]] or [[target|display]]
      text = text.gsub(/\[\[([^\]|#]+?)(?:#[^\]|]*)?\|([^\]]+?)\]\]/) do
        slug = resolve_slug($1.strip, title_to_slug)
        slug ? %(<a href="##{slug}" class="wiki-link">#{$2.strip}</a>) : $2.strip
      end
      # [[target#anchor]] or [[target]]
      text = text.gsub(/\[\[([^\]]+?)\]\]/) do
        target = $1.strip.split('#').first.strip
        slug = resolve_slug(target, title_to_slug)
        slug ? %(<a href="##{slug}" class="wiki-link">#{target}</a>) : target
      end
      text
    end

    def resolve_slug(target, title_to_slug)
      key = target.downcase
      return title_to_slug[key] if title_to_slug.key?(key)
      # Partial fallback: filename contains the link text
      match = title_to_slug.keys.find { |k| k.include?(key) }
      match ? title_to_slug[match] : nil
    end

    def slugify(title)
      s = title.downcase
      {
        /[àáâãäå]/ => 'a', /[èéêë]/ => 'e', /[ìíîï]/ => 'i',
        /[òóôõö]/ => 'o', /[ùúûü]/ => 'u', /[ñ]/ => 'n',
        /[çć]/ => 'c', /[ðđ]/ => 'd', /[þ]/ => 'th',
        /[ý]/ => 'y', /[æ]/ => 'ae', /[œ]/ => 'oe',
        /[ł]/ => 'l', /[ß]/ => 'ss', /[ȳ]/ => 'y'
      }.each { |pat, rep| s.gsub!(pat, rep) }
      s.gsub(/[^a-z0-9]+/, '-').gsub(/\A-+|-+\z/, '')
    end
  end
end
