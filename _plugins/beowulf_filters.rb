# Liquid filters for the Beowulf parallel-text pages (beowulf/<part>/).
#
# Each part keeps its text in three plain files — translation.txt,
# original.txt, gloss.txt — with stanzas separated by blank lines.
# _includes/beowulf-part.html reads them and builds the .bw-parallel grid.
#
# Per-file conventions (applied by bw_stanzas via its `kind` argument):
#   'oe'    — a tab (or run of 2+ spaces) marks the caesura; becomes &emsp;
#   'gloss' — **CAPS** marks a Leipzig category label; becomes <b>CAPS</b>
#   'tr'    — lines are used verbatim
module Jekyll
  module BeowulfFilters
    # Split raw text into stanzas (blank-line separated) of formatted lines.
    def bw_stanzas(input, kind = 'tr')
      input.to_s.gsub("\r\n", "\n").strip.split(/\n\s*\n/).map do |stanza|
        stanza.split("\n").map { |line| bw_format_line(line.strip, kind) }
      end
    end

    private

    def bw_format_line(line, kind)
      case kind
      when 'oe'    then line.gsub(/\t+| {2,}/, '&emsp;')
      when 'gloss' then line.gsub(/\*\*(.+?)\*\*/, '<b>\1</b>')
      else line
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::BeowulfFilters)
