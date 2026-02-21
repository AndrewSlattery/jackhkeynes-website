
require 'minitest/autorun'
require 'tempfile'
require 'fileutils'

# Mock Jekyll::Generator so we can load the plugin without Jekyll
module Jekyll
  class Generator
    def self.safe(val); end
    def self.priority(val); end
  end
end

# Load the plugin
require_relative '../_plugins/dictionary_generator'

class TestDictionaryGenerator < Minitest::Test
  def setup
    @generator = Jekyll::DictionaryGenerator.new
    @temp_file = Tempfile.new('test_dictionary.db')
  end

  def teardown
    @temp_file.close
    @temp_file.unlink
  end

  def write_to_file(content)
    @temp_file.write(content)
    @temp_file.rewind
  end

  def test_parse_simple_entry
    content = <<~MDF
      \\lx hello
      \\ge greeting
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal "hello", entries[0]["lx"]
    assert_equal "greeting", entries[0]["ge"]
  end

  def test_parse_examples
    content = <<~MDF
      \\lx hello
      \\xv first example
      \\xe first translation
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal 1, entries[0]["examples"].length
    assert_equal "first example", entries[0]["examples"][0]["vernacular"]
    assert_equal "first translation", entries[0]["examples"][0]["english"]
  end

  def test_skip_headers
    content = <<~MDF
      \\_Header line
      \\lx hello
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal "hello", entries[0]["lx"]
  end

  def test_multiple_entries
    content = <<~MDF
      \\lx first
      \\lx second
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 2, entries.length
    assert_equal "first", entries[0]["lx"]
    assert_equal "second", entries[1]["lx"]
  end

  def test_multiple_examples
    content = <<~MDF
      \\lx word
      \\xv ex1
      \\xe trans1
      \\xv ex2
      \\xe trans2
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal 2, entries[0]["examples"].length
    assert_equal "ex1", entries[0]["examples"][0]["vernacular"]
    assert_equal "trans1", entries[0]["examples"][0]["english"]
    assert_equal "ex2", entries[0]["examples"][1]["vernacular"]
    assert_equal "trans2", entries[0]["examples"][1]["english"]
  end

  def test_example_without_translation
    content = <<~MDF
      \\lx word
      \\xv incomplete example
      \\lx next
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    # The incomplete example is saved when the next entry starts
    assert_equal 2, entries.length
    assert_equal 1, entries[0]["examples"].length
    assert_equal "incomplete example", entries[0]["examples"][0]["vernacular"]
    assert_nil entries[0]["examples"][0]["english"]
  end

  def test_translation_without_sentence
    content = <<~MDF
      \\lx word
      \\xe translation only
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal 1, entries[0]["examples"].length
    assert_equal "translation only", entries[0]["examples"][0]["english"]
    assert_nil entries[0]["examples"][0]["vernacular"]
  end

  def test_repeated_markers
    content = <<~MDF
      \\lx word
      \\ge definition 1
      \\ge definition 2
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal ["definition 1", "definition 2"], entries[0]["ge"]
  end

  def test_empty_lines
    content = <<~MDF

      \\lx word

      \\ge definition

    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal "word", entries[0]["lx"]
    assert_equal "definition", entries[0]["ge"]
  end

  def test_example_pending_at_eof
    content = <<~MDF
      \\lx word
      \\xv last example
    MDF
    write_to_file(content)

    entries = @generator.parse_mdf(@temp_file.path)

    assert_equal 1, entries.length
    assert_equal 1, entries[0]["examples"].length
    assert_equal "last example", entries[0]["examples"][0]["vernacular"]
    assert_nil entries[0]["examples"][0]["english"]
  end
end
