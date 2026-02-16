require 'minitest/autorun'
require 'jekyll'
require 'tempfile'
require 'fileutils'
require_relative '../_plugins/dictionary_generator.rb'

class TestDictionaryGenerator < Minitest::Test
  def setup
    @config = Jekyll.configuration({})
    @generator = Jekyll::DictionaryGenerator.new(@config)
  end

  def with_temp_mdf(content)
    file = Tempfile.new(['test_dictionary', '.db'])
    file.write(content)
    file.close
    yield file.path
  ensure
    file.unlink
  end

  def test_generator_instantiation
    refute_nil @generator
    assert_kind_of Jekyll::Generator, @generator
  end

  def test_basic_entry
    content = <<~MDF
      \\lx hello
      \\ps n
      \\ge greeting
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 1, entries.length

      entry = entries.first
      assert_equal "hello", entry["lx"]
      assert_equal "n", entry["ps"]
      assert_equal "greeting", entry["ge"]
      assert_nil entry["examples"] # Should be removed if empty
    end
  end

  def test_examples
    content = <<~MDF
      \\lx word
      \\xv This is a sentence.
      \\xe This is a translation.
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 1, entries.length

      entry = entries.first
      assert_equal "word", entry["lx"]
      refute_nil entry["examples"]
      assert_equal 1, entry["examples"].length

      example = entry["examples"].first
      assert_equal "This is a sentence.", example["vernacular"]
      assert_equal "This is a translation.", example["english"]
    end
  end

  def test_multiple_entries
    content = <<~MDF
      \\lx one
      \\ge first

      \\lx two
      \\ge second
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 2, entries.length

      assert_equal "one", entries[0]["lx"]
      assert_equal "first", entries[0]["ge"]

      assert_equal "two", entries[1]["lx"]
      assert_equal "second", entries[1]["ge"]
    end
  end

  def test_arrays
    content = <<~MDF
      \\lx word
      \\ge definition 1
      \\ge definition 2
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 1, entries.length

      entry = entries.first
      assert_kind_of Array, entry["ge"]
      assert_equal ["definition 1", "definition 2"], entry["ge"]
    end
  end

  def test_edge_cases
    content = <<~MDF
      \\_Header Metadata
      \\lx word1
      \\xv Incomplete example
      \\lx word2
      \\xe Translation without sentence
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 2, entries.length

      # Entry 1: word1 with incomplete example
      entry1 = entries[0]
      assert_equal "word1", entry1["lx"]
      assert_equal 1, entry1["examples"].length
      assert_equal "Incomplete example", entry1["examples"][0]["vernacular"]
      assert_nil entry1["examples"][0]["english"]

      # Entry 2: word2 with translation only
      entry2 = entries[1]
      assert_equal "word2", entry2["lx"]
      assert_equal 1, entry2["examples"].length
      assert_nil entry2["examples"][0]["vernacular"]
      assert_equal "Translation without sentence", entry2["examples"][0]["english"]
    end
  end

  def test_consecutive_examples_without_translation
    content = <<~MDF
      \\lx word
      \\xv Example 1
      \\xv Example 2
      \\xe Translation 2
    MDF

    with_temp_mdf(content) do |path|
      entries = @generator.parse_mdf(path)
      assert_equal 1, entries.length

      examples = entries[0]["examples"]
      assert_equal 2, examples.length

      assert_equal "Example 1", examples[0]["vernacular"]
      assert_nil examples[0]["english"]

      assert_equal "Example 2", examples[1]["vernacular"]
      assert_equal "Translation 2", examples[1]["english"]
    end
  end
end
