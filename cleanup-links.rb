puts "🧹 Starting Cleanup: Removing squares.io and renaming 'Parse'..."
puts "-------------------------------------------------------------"

squares_removed = 0
parses_renamed = 0

Dir.glob("_posts/*.md") do |filepath|
  content = File.read(filepath)
  original_content = content.dup

  # 1. REMOVE SQUARES.IO LINKS
  # ---------------------------------------------------------
  # Matches Markdown: [squares.io](...)
  # Matches HTML: <a href="...squares.io...">squares.io</a>
  
  # Remove Markdown versions
  content.gsub!(/\[squares\.io\]\(https?:\/\/squares\.io.*?\)/i) do
    squares_removed += 1
    ""
  end

  # Remove HTML versions (just in case some remain)
  content.gsub!(/<a\s+[^>]*href=["']https?:\/\/squares\.io.*?["'][^>]*>.*?<\/a>/i) do
    squares_removed += 1
    ""
  end

  # 2. CLEAN UP PUNCTUATION LEFT BEHIND
  # ---------------------------------------------------------
  # Removing the link might leave patterns like "(, " or " , )"
  
  # Fix "( , " -> "("
  content.gsub!(/\(\s*,\s*/, '(')
  
  # Fix " , )" -> ")"
  content.gsub!(/\s*,\s*\)/, ')')
  
  # Fix empty parens "()" -> "" (if the brackets are now empty, remove them)
  content.gsub!(/\(\s*\)/, '')

  # 3. RENAME "Parse" TO "parses"
  # ---------------------------------------------------------
  # Finds [Parse](...) and changes text to [parses]
  content.gsub!(/\[Parse\]\(/) do
    parses_renamed += 1
    "[parses]("
  end

  # Finds >Parse</a> and changes text to >parses</a>
  content.gsub!(/>Parse<\/a>/) do
    parses_renamed += 1
    ">parses</a>"
  end

  # SAVE CHANGES
  if content != original_content
    File.write(filepath, content)
    puts "  ✨ Cleaned #{File.basename(filepath)}"
  end
end

puts "-------------------------------------------------------------"
puts "✅ Done!"
puts "   - Removed #{squares_removed} broken squares.io links."
puts "   - Renamed #{parses_renamed} 'Parse' links to 'parses'."