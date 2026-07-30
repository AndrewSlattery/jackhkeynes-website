---
layout: page
title: "Invictus — a French translation"
permalink: /invictus/
---

My verse translation into French of *Invictus* by William Ernest Henley
(1849–1903), written in 1875 and first published in *A Book of Verses* (1888).
The original is at the
[Poetry Foundation](https://www.poetryfoundation.org/poems/51642/invictus).

The middle column is a plain literal rendering of the French, for readers who
would rather not take my word for it — it makes no attempt at metre or rhyme.

{% capture fr %}{% include_relative french.txt %}{% endcapture %}
{% capture li %}{% include_relative literal.txt %}{% endcapture %}
{% capture en %}{% include_relative original.txt %}{% endcapture %}
{% include poem-parallel.html
   col1=fr label1="French" lang1="fr"
   col2=li label2="Literal English"
   col3=en label3="Henley's original" %}
