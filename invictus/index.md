---
layout: page
title: "Invictus — a French translation"
permalink: /invictus/
---

My verse translation into French of *Invictus* by William Ernest Henley
(1849–1903), written in 1875 and first published in *A Book of Verses* (1888).
The original is drawn from the
[Poetry Foundation](https://www.poetryfoundation.org/poems/51642/invictus).

{% capture fr %}{% include_relative french.txt %}{% endcapture %}
{% capture li %}{% include_relative literal.txt %}{% endcapture %}
{% capture en %}{% include_relative original.txt %}{% endcapture %}
{% include poem-parallel.html
   col1=fr label1="French" lang1="fr"
   col2=li label2="Literal English"
   col3=en label3="Henley's original" %}
