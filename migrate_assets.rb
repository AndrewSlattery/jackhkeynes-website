require 'fileutils'
require 'open-uri'
require 'uri'
require 'net/http'

# CONFIGURATION
ASSETS_DIR = "assets/misc"
FileUtils.mkdir_p(ASSETS_DIR)

# Domains we want to download from
TARGET_DOMAINS = [
  'drive.google.com',
  'blogger.googleusercontent.com',
  'bp.blogspot.com',
  'i.ibb.co',
  'docs.google.com'
]

# Standard Browser Headers to prevent blocking
HEADERS = {
  "User-Agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download_drive_file(url, output_path)
  # Extract ID
  if url =~ /\/d\/(.*?)\//
    file_id = $1
    download_url = "https://drive.google.com/uc?export=download&id=#{file_id}"
    
    if url.include?("spreadsheets")
      download_url = "https://docs.google.com/spreadsheets/d/#{file_id}/export?format=xlsx"
    end

    print "    (Connecting to Drive)... "
    
    begin
      uri = URI(download_url)
      Net::HTTP.start(uri.host, uri.port, :use_ssl => true) do |http|
        http.read_timeout = 10 # Stop if stuck for 10s
        http.open_timeout = 10
        
        request = Net::HTTP::Get.new(uri, HEADERS)
        response = http.request(request)
        
        if response.code == '302' || response.code == '303'
          download_url = response['location']
          uri = URI(download_url)
          
          # Re-request the new location
          request = Net::HTTP::Get.new(uri, HEADERS)
          response = http.request(request)
        end
        
        if response.code == '200'
          File.open(output_path, "wb") { |f| f.write(response.body) }
          return true
        else
          puts "❌ Server returned #{response.code}"
          return false
        end
      end
    rescue => e
      puts "❌ Error: #{e.message}"
      return false
    end
  else
    return false
  end
end

def download_direct_file(url, output_path)
  print "    (Downloading)... "
  begin
    # URI.open with headers and options handles redirects automatically
    URI.open(url, HEADERS.merge(read_timeout: 10, open_timeout: 10)) do |image|
      File.open(output_path, "wb") do |file|
        file.write(image.read)
      end
    end
    return true
  rescue OpenURI::HTTPError => e
    puts "❌ HTTP Error: #{e.message}"
    return false
  rescue Net::OpenTimeout, Net::ReadTimeout
    puts "❌ Timed out (Server didn't respond)"
    return false
  rescue => e
    puts "❌ Error: #{e.message}"
    return false
  end
end

puts "📦 Starting Asset Migration (v2 - Anti-Hang Mode)"
puts "-------------------------------------------------"

Dir.glob("_posts/*.md") do |filepath|
  content = File.read(filepath)
  original_content = content.dup
  filename_slug = File.basename(filepath, ".md")[11..-1]
  
  matches = []
  content.scan(/(\[.*?\]\((https?:\/\/.*?)\))/) { |m| matches << {full: m[0], url: m[1], type: :markdown} }
  content.scan(/(<a\s+.*?href=["'](https?:\/\/.*?)["'].*?>)/) { |m| matches << {full: m[0], url: m[1], type: :html} }

  file_changed = false
  asset_counter = 1

  matches.each do |match|
    url = match[:url]
    host = URI.parse(url).host rescue nil
    
    if host && TARGET_DOMAINS.any? { |d| host.include?(d) }
      puts "\nFound in: #{File.basename(filepath)}"
      puts "  Link: #{url}"

      ext = File.extname(URI.parse(url).path)
      if ext.empty? || ext.length > 5
        if url.include?("drive.google.com") then ext = ".pdf"
        elsif url.include?("spreadsheets") then ext = ".xlsx"
        else ext = ".png"
        end
      end

      new_filename = "#{filename_slug}-#{asset_counter}#{ext}"
      local_path = File.join(ASSETS_DIR, new_filename)
      web_path = "/#{ASSETS_DIR}/#{new_filename}"

      success = false
      if host.include?("drive.google.com") || host.include?("docs.google.com")
        success = download_drive_file(url, local_path)
      else
        success = download_direct_file(url, local_path)
      end

      if success
        puts "✅ Saved to #{local_path}"
        if match[:type] == :markdown
          content.gsub!(match[:url], web_path)
        elsif match[:type] == :html
          content.gsub!(match[:url], web_path)
        end
        file_changed = true
        asset_counter += 1
      else
        puts "⚠️  Skipping replacement."
      end
    end
  end

  if file_changed
    File.write(filepath, content)
    puts "  💾 Updated Markdown file."
  end
end

puts "\n-----------------------------"
puts "Done! Check /assets/misc/ for results."