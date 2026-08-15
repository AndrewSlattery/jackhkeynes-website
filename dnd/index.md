---
layout: page
title: "Dungeons & Dragons"
permalink: /dnd/
description: Homebrew subclasses and species I have written for the 2024 rules
---

Homebrew material I have written for the 2024 *Dungeons &amp; Dragons* rules. Each
page sets out a single subclass or species in full, in the wording it would have
in a rulebook.

{%- assign hb_pages = site.pages | where: "homebrew", true | sort: "title" %}
<ul class="hb-index">
{%- for hb in hb_pages %}
  <li>
    <a class="hb-card" href="{{ hb.url | relative_url }}">
      <span class="hb-card-kind">{{ hb.kind }}</span>
      <span class="hb-card-title">{{ hb.title }}</span>
      {%- if hb.tagline %}
      <span class="hb-card-tagline">{{ hb.tagline }}</span>
      {%- endif %}
    </a>
  </li>
{%- endfor %}
</ul>
