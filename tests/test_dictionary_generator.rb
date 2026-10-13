
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

  def parse(content)
    write_to_file(content)
    @generator.parse_mdf(@temp_file.path)
  end

  def test_parse_simple_entry
    entries = parse(<<~MDF)
      \\lx hello
      \\ge greeting
    MDF

    assert_equal 1, entries.length
    assert_equal "hello", entries[0]["lx"]
    assert_equal [{ "ge" => ["greeting"] }], entries[0]["senses"]
  end

  def test_parse_examples
    entries = parse(<<~MDF)
      \\lx hello
      \\xv first example
      \\xe first translation
    MDF

    examples = entries[0]["senses"][0]["examples"]
    assert_equal 1, examples.length
    assert_equal "first example", examples[0]["vernacular"]
    assert_equal "first translation", examples[0]["english"]
  end

  def test_skip_headers
    entries = parse(<<~MDF)
      \\_sh v3.0  400  MDF
      \\_DateStampHasFourDigitYear
      \\lx hello
    MDF

    assert_equal 1, entries.length
    assert_equal({ "lx" => "hello" }, entries[0])
  end

  def test_byte_order_mark_is_ignored
    entries = parse("﻿\\lx hello\n\\ge greeting\n")

    assert_equal "hello", entries[0]["lx"]
  end

  def test_multiple_entries
    entries = parse(<<~MDF)
      \\lx first
      \\lx second
    MDF

    assert_equal 2, entries.length
    assert_equal "first", entries[0]["lx"]
    assert_equal "second", entries[1]["lx"]
  end

  def test_multiple_examples
    entries = parse(<<~MDF)
      \\lx word
      \\xv ex1
      \\xe trans1
      \\xv ex2
      \\xe trans2
    MDF

    examples = entries[0]["senses"][0]["examples"]
    assert_equal [
      { "vernacular" => "ex1", "english" => "trans1" },
      { "vernacular" => "ex2", "english" => "trans2" }
    ], examples
  end

  def test_example_without_translation
    entries = parse(<<~MDF)
      \\lx word
      \\xv incomplete example
      \\xe
      \\lx next
    MDF

    assert_equal 2, entries.length
    assert_equal [{ "vernacular" => "incomplete example" }], entries[0]["senses"][0]["examples"]
  end

  def test_translation_without_sentence
    entries = parse(<<~MDF)
      \\lx word
      \\xe translation only
    MDF

    assert_equal [{ "english" => "translation only" }], entries[0]["senses"][0]["examples"]
  end

  def test_repeated_glosses_stay_in_one_sense
    entries = parse(<<~MDF)
      \\lx word
      \\ps n
      \\ge definition 1
      \\ge definition 2
    MDF

    assert_equal [{ "ps" => "n", "ge" => ["definition 1", "definition 2"] }], entries[0]["senses"]
  end

  def test_empty_lines
    entries = parse(<<~MDF)

      \\lx word

      \\ge definition

    MDF

    assert_equal 1, entries.length
    assert_equal "word", entries[0]["lx"]
    assert_equal ["definition"], entries[0]["senses"][0]["ge"]
  end

  def test_example_pending_at_eof
    entries = parse(<<~MDF)
      \\lx word
      \\xv last example
    MDF

    assert_equal [{ "vernacular" => "last example" }], entries[0]["senses"][0]["examples"]
  end

  def test_each_part_of_speech_is_a_separate_sense
    entries = parse(<<~MDF)
      \\lx a tug
      \\ps adv

      \\ge for fun
      \\ge voluntarily

      \\ps adj

      \\ge friendly

      \\xv Masctig por cors a tug teyen boncop.
      \\xe Tickets for friendly games were cheap.

      \\ps conj

      \\ge so that

      \\et Middle Borlish idiom.
      \\mn tug
    MDF

    entry = entries[0]
    assert_equal %w[adv adj conj], entry["senses"].map { |s| s["ps"] }
    assert_equal ["for fun", "voluntarily"], entry["senses"][0]["ge"]
    assert_equal ["friendly"], entry["senses"][1]["ge"]
    assert_equal ["so that"], entry["senses"][2]["ge"]
    assert_nil entry["senses"][0]["examples"]
    assert_equal "Tickets for friendly games were cheap.", entry["senses"][1]["examples"][0]["english"]
    assert_equal "Middle Borlish idiom.", entry["et"]
    assert_equal ["tug"], entry["mn"]
  end

  def test_sense_level_markers_attach_to_their_sense
    entries = parse(<<~MDF)
      \\lx agr
      \\ps adj
      \\uv -errem
      \\ue archaic
      \\ge sharp
      \\ps n
      \\de a definition
      \\ge acid
      \\dv a vernacular definition
    MDF

    adj, noun = entries[0]["senses"]
    assert_equal({ "ps" => "adj", "uv" => ["-errem"], "ue" => ["archaic"], "ge" => ["sharp"] }, adj)
    assert_equal({ "ps" => "n", "de" => ["a definition"], "ge" => ["acid"], "dv" => ["a vernacular definition"] }, noun)
  end

  def test_homonym_number_before_or_after_part_of_speech
    entries = parse(<<~MDF)
      \\lx sy
      \\ps pron
      \\hm 1
      \\ge his
      \\lx sy
      \\hm 2
      \\ps adv
      \\ge so
    MDF

    assert_equal %w[1 2], entries.map { |e| e["hm"] }
    assert_equal 1, entries[0]["senses"].length
    assert_equal 1, entries[1]["senses"].length
  end

  def test_subentries_are_kept_separate_from_the_main_entry
    entries = parse(<<~MDF)
      \\lx mornç
      \\ps n
      \\ge bite
      \\et Old Borlish
      \\mn mordr

      \\se mornç a morn
      \\ps n
      \\ge piece of the action
      \\xv Example.
      \\xe Translation.
      \\et literally "bite at a carrot"
      \\mn morn

      \\se second sub
      \\ps adj
      \\ge another
      \\lx next
    MDF

    main = entries[0]
    assert_equal 2, entries.length
    assert_equal [{ "ps" => "n", "ge" => ["bite"] }], main["senses"]
    assert_equal "Old Borlish", main["et"]
    assert_equal ["mordr"], main["mn"]

    sub = main["subentries"][0]
    assert_equal "mornç a morn", sub["lx"]
    assert_equal ["piece of the action"], sub["senses"][0]["ge"]
    assert_equal "Translation.", sub["senses"][0]["examples"][0]["english"]
    assert_equal 'literally "bite at a carrot"', sub["et"]
    assert_equal ["morn"], sub["mn"]

    assert_equal "second sub", main["subentries"][1]["lx"]
    assert_nil entries[1]["subentries"]
  end

  def test_continuation_lines_and_paragraphs
    entries = parse(<<~MDF)
      \\lx caum
      \\et disputed. First paragraph
      continues on the next line.

      Second paragraph.


      Third paragraph.

      \\mn carmen
    MDF

    assert_equal "disputed. First paragraph continues on the next line.\n\nSecond paragraph.\n\nThird paragraph.",
                 entries[0]["et"]
    assert_equal ["carmen"], entries[0]["mn"]
  end

  def test_value_on_line_after_empty_marker
    entries = parse(<<~MDF)
      \\lx la
      \\et
      Old Borlish < Latin illa
    MDF

    assert_equal "Old Borlish < Latin illa", entries[0]["et"]
  end

  def test_empty_markers_are_dropped
    entries = parse(<<~MDF)
      \\lx veram
      \\ps adv
      \\ge
      \\ge really
      \\et
    MDF

    assert_equal [{ "ps" => "adv", "ge" => ["really"] }], entries[0]["senses"]
    refute entries[0].key?("et")
  end

  def test_repeated_etymologies_become_paragraphs
    entries = parse(<<~MDF)
      \\lx benoçabr
      \\et Old Borlish, from benoçar
      \\mn benoçar
      \\et Old Borlish
    MDF

    assert_equal "Old Borlish, from benoçar\n\nOld Borlish", entries[0]["et"]
  end

  def test_record_level_markers_are_lists
    entries = parse(<<~MDF)
      \\lx Aost
      \\ps n
      \\ge August
      \\sd Months
      \\cf aostal
    MDF

    assert_equal ["Months"], entries[0]["sd"]
    assert_equal ["aostal"], entries[0]["cf"]
  end
end
