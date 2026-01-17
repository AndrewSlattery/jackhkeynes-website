require 'rexml/document'
require 'fileutils'
require 'date'

# Configuration
SOURCE_FILE = 'blog.xml'
OUTPUT_DIR = '_posts'

# Create output directory
FileUtils.mkdir_p(OUTPUT_DIR)

# Read the XML file
puts "🔍 Reading #{SOURCE_FILE}..."
file_content = File.read(SOURCE_FILE)
doc = REXML::Document.new(file_content)

# Data Stores
posts = {}     # Key: Post ID, Value: Post Data
comments = {}  # Key: Post ID (parent), Value: Array of Comments

puts "📊 Analyzing entries..."

# --- PASS 1: READ EVERYTHING ---
doc.elements.each('feed/entry') do |entry|
  id = entry.elements['id'].text.strip
  
  # Determine if this is a Post or a Comment
  # We check the explicitly defined type in the 2018 schema
  type_element = entry.elements['blogger:type']
  entry_type = type_element ? type_element.text : nil

  if entry_type == 'COMMENT'
    # === IT IS A COMMENT ===
    # In your file, 'blogger:parent' points to the Post ID
    parent_element = entry.elements['blogger:parent']
    
    # Fallback for older exports if blogger:parent is missing
    parent_id = if parent_element
                  parent_element.text.strip
                elsif entry.elements['thr:in-reply-to']
                  entry.elements['thr:in-reply-to'].attributes['ref']
                else
                  nil
                end

    next unless parent_id # Skip if we can't find who it belongs to

    author = entry.elements['author/name']&.text || "Anonymous"
    content = entry.elements['content']&.text || ""
    published = entry.elements['published'].text
    date_str = Date.parse(published).strftime('%Y-%m-%d')

    # Initialize array if empty
    comments[parent_id] ||= []
    comments[parent_id] << {
      author: author,
      date: date_str,
      content: content
    }

  elsif entry_type == 'POST' || entry_type.nil? 
    # === IT IS A POST ===
    # Check status
    status_element = entry.elements['blogger:status']
    next if status_element && status_element.text != 'LIVE'
    
    # Extract Post Data
    title = entry.elements['title'].text
    published = entry.elements['published'].text
    content = entry.elements['content'].text
    orig_url = entry.elements['blogger:filename']&.text

    # Store it
    posts[id] = {
      title: title,
      published: published,
      content: content,
      orig_url: orig_url
    }
  end
end

puts "✅ Found #{posts.length} posts and #{comments.values.flatten.length} comments."

# --- PASS 2: GENERATE FILES ---
posts.each do |post_id, p_data|
  
  # Prepare Filename
  date_obj = Date.parse(p_data[:published])
  date_str = date_obj.strftime('%Y-%m-%d')
  
  slug = if p_data[:orig_url]
           File.basename(p_data[:orig_url], ".*")
         else
           p_data[:title].downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')
         end
  
  filename = "#{OUTPUT_DIR}/#{date_str}-#{slug}.md"

  # Smart Crossword Extraction
  content = p_data[:content]
  puzzle_id = nil
  puzzle_set = nil
  
  # Detect AmuseLabs
  if content =~ /crossword\?id=([a-z0-9]+)(?:&amp;|&)set=([a-z0-9]+)/
    puzzle_id = $1
    puzzle_set = $2
    # Remove the iframe logic
    content = content.gsub(/<iframe.*?#{puzzle_id}.*?<\/iframe>/m, '')
  end

  # Write File
  File.open(filename, 'w') do |f|
    f.puts "---"
    f.puts "layout: post"
    f.puts "title: \"#{p_data[:title].gsub('"', '\"')}\""
    f.puts "date: #{p_data[:published]}"
    if puzzle_id
      f.puts "puzzle_id: #{puzzle_id}"
      f.puts "puzzle_set: #{puzzle_set}"
    end
    f.puts "---"
    f.puts ""
    f.puts content.strip
    f.puts ""

    # === APPEND COMMENTS ===
    # Check if this post ID has comments in our dictionary
    post_comments = comments[post_id]
    
    if post_comments && post_comments.any?
      f.puts ""
      f.puts "---"
      f.puts "### 💬 Archived Comments"
      f.puts ""
      
      # Sort comments by date
      post_comments.sort_by { |c| c[:date] }.each do |c|
        f.puts "**#{c[:author]}** *on #{c[:date]}*"
        clean_comment = c[:content].gsub(/<[^>]+>/, '') # Strip HTML tags from comments
        f.puts "> #{clean_comment.strip.gsub(/\n/, "\n> ")}" 
        f.puts ""
      end
    end
  end
  
  puts "📝 Wrote: #{filename}"
end

puts "🎉 Migration Complete!"