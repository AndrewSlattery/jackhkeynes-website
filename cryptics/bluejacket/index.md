---
layout: default
title: Bluejacket
permalink: /cryptics/bluejacket/
---

<div class="home">
  <h1 class="page-heading">Bluejacket</h1>

  <p>Crosswords published under the pseudonym Bluejacket.</p>

  {%- assign sorted = site.bluejacket | sort: "bluejacket_number" | reverse -%}

  <ul class="post-list">
    {%- for puzzle in sorted -%}
      <li>
        {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
        <span class="post-meta">{{ puzzle.date | date: date_format }}</span>
        <h3>
          <a class="post-link" href="{{ puzzle.url | relative_url }}">
            {{ puzzle.title | escape }}
          </a>
        </h3>
      </li>
    {%- endfor -%}
  </ul>
</div>
