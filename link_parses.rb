require 'fileutils'

POSTS_DIR = '_posts'
PARSES_DIR = 'assets/parses'

puts "🔍 Scanning posts..."
updated_count = 0

Dir.glob("#{POSTS_DIR}/*.md").each do |filepath|
  content = File.read(filepath)
  
  # --- 1. LOOSER TITLE DETECTION ---
  # Matches: title: "#318...", title: 'Grid 318...', title: No. 318
  if content =~ /title:\s*["']?.*?(?:#|Grid\s|No\.?\s?)(\d+)/i
    grid_num = $1
    local_filename = "#{grid_num}.txt"
    local_path = "#{PARSES_DIR}/#{local_filename}"
    
    # --- DEBUGGING FOR PROBLEM POSTS (301-320) ---
    is_problem_post = (301..320).include?(grid_num.to_i)
    if is_problem_post
      puts "------------------------------------------------"
      puts "🔎 Diagnosing Grid ##{grid_num} (#{File.basename(filepath)})"
    end

    # --- 2. CHECK LOCAL FILE ---
    if File.exist?(local_path)
      if is_problem_post
        puts "   ✅ Local file found: #{local_filename}" 
      end

      original_content = content.dup
      new_link_url = "/assets/parses/#{local_filename}"
      
      # --- 3. REPLACEMENT LOGIC ---
      
      # A. HTML Links (<a href="...">parses</a>)
      # Improved regex: Handles extra attributes, newlines, and loose text matching
      if content.gsub!(/<a\s+(?:[^>]*?\s+)?href=["'](https:\/\/(?:drive|docs)\.google\.com[^"']*)["'][^>]*>(.*?)<\/a>/im) do |match|
        link_url = $1
        link_text = $2
        # Only replace if the text looks like "parse" or "solution"
        if link_text =~ /parses?|solution/i
          "[Parse](#{new_link_url})"
        else
          match # Return original if text doesn't match
        end
      end
        if is_problem_post; puts "   🛠️  Fixed HTML link"; end
      end

      # B. Markdown Links ([parses](...))
      if content.gsub!(/\[(parses?|solution)\]\(https:\/\/(?:drive|docs)\.google\.com[^\)]+\)/i, "[Parse](#{new_link_url})")
        if is_problem_post; puts "   🛠️  Fixed Markdown link"; end
      end
      
      # Save if changed
      if content != original_content
        File.write(filepath, content)
        puts "✅ Updated Grid ##{grid_num}"
        updated_count += 1
      elsif is_problem_post
        # If we have the file but didn't update, maybe the regex failed?
        puts "   ⚠️  File exists, but no Google Drive link found to replace."
        puts "       (Check if the link text is 'parses' or something else?)"
      end

    else
      if is_problem_post
        puts "   ❌ MISSING FILE: Expected '#{local_path}' but didn't find it."
      end
    end
  end
end

puts "------------------------------------------------"
puts "🎉 Run Complete. Updated #{updated_count} posts."