---
layout: page
title: "Dungeons & Dragons"
permalink: /dnd/
description: Homebrew material for Dungeons & Dragons (2024)
---

Homebrew material for the 2024 *Dungeons &amp; Dragons* rules.

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
