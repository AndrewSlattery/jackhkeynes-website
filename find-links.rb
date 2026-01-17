require 'uri'

# Configure this list to ignore domains you know are safe (like your own site or puzzle apps)
IGNORED_DOMAINS = [
  'jackhkeynes.co.uk',
  'puzzleme.amuselabs.com',
  'squares.io',            # Assuming you want to keep these external
  'crossword.info',
  'mycrossword.co.uk',
  'twitter.com',
  'blogger.com',
  'blogspot.com',
  'github.io',
  'gnomoncryptics.com',
  'kjcharleswriter.com',
  'fandom.com',
  'andrewt.net'
]

puts "Scanning posts for external links..."
puts "-----------------------------------"

Dir.glob("_posts/*.md") do |file|
  content = File.read(file)
  
  # Regex to find standard Markdown links [text](url)
  links = content.scan(/\[.*?\]\((https?:\/\/.*?)\)/).flatten
  
  # Regex to find HTML links <a href="url">
  html_links = content.scan(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/.*?)["']/).flatten
  
  all_links = links + html_links

  all_links.each do |url|
    begin
      host = URI.parse(url).host
      next if host.nil? # Skip relative paths
      
      # If the domain is NOT in our ignore list, print it
      unless IGNORED_DOMAINS.any? { |d| host.include?(d) }
        puts "File: #{File.basename(file)}"
        puts "  Link: #{url}"
      end
    rescue URI::InvalidURIError
      # Ignore malformed URLs
    end
  end
end