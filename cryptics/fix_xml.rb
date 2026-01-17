filename = 'blog.xml'

# Read the file
content = File.read(filename)

# Find any <title> tag (even if it has other attributes) and force it to be type="text"
new_content = content.gsub(/<title.*?>/, '<title type="text">')

# Save the file
File.write(filename, new_content)

puts "✅ Fixed all <title> tags in #{filename}. You can now run the import."