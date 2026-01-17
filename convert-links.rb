puts "🔗 Starting HTML Link to Markdown Conversion..."
puts "---------------------------------------------"

# Counter for stats
total_converted = 0

Dir.glob("_posts/*.md") do |filepath|
  content = File.read(filepath)
  original_content = content.dup
  
  # Regex explanation:
  # <a\s+             : Matches <a followed by whitespace
  # [^>]*?            : Matches any other attributes before href (non-greedy)
  # href=["']         : Matches href= followed by a quote
  # ([^"']*)          : Capture Group 1: The URL
  # ["']              : Matches the closing quote
  # [^>]* : Matches any other attributes after href (like target, class)
  # >                 : End of the opening tag
  # (.*?)             : Capture Group 2: The Link Text
  # <\/a>             : The closing tag
  # /im               : Case-insensitive (i) and multi-line (m) support
  
  content.gsub!(/<a\s+[^>]*?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/im) do |match|
    url = $1
    text = $2.strip
    
    # Optional: Only convert if it starts with http (Online links)
    # Remove the 'if' condition below if you want to convert ALL links (including local ones)
    if url.start_with?("http")
      total_converted += 1
      "[#{text}](#{url})"
    else
      # If it's a local link (e.g. /assets/...), keep it as is, or remove this else block to convert everything.
      # based on your request "links that go online", we default to http checks.
      # To convert EVERYTHING, just return "[#{text}](#{url})" directly.
      match 
    end
  end

  if content != original_content
    File.write(filepath, content)
    puts "  📝 Updated #{File.basename(filepath)}"
  end
end

puts "---------------------------------------------"
puts "✅ Done! Converted #{total_converted} links to Markdown format."