# skip_external_data.rb
#
# Prevents Jekyll from auto-parsing files inside _data/external_dictionary,
# which is a git submodule (full GitHub repo clone) containing TSV, YAML, and
# JSON files that are not Jekyll data files. Without this, Jekyll tries to parse
# e.g. manifest.tsv and all_claims_final.yaml and raises CSV/YAML errors.
#
# The submodule is still available on disk for other plugins (e.g.
# dictionary_generator.rb) that read it directly.

module Jekyll
  module ExternalDataSkipper
    def read_data_to(dir, data)
      skip_root = File.expand_path(
        File.join(site.source, "_data", "external_dictionary")
      )
      return if File.expand_path(dir).start_with?(skip_root)
      super
    end
  end

  DataReader.prepend(ExternalDataSkipper)
end
