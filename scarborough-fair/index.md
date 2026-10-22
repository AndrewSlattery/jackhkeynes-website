---
layout: page
title: "Scarborough Fair — a French translation"
permalink: /scarborough-fair/
---

My verse translation into French of *Scarborough Fair*, the traditional
English ballad, here relocated from the Yorkshire coast to Cherbourg.

{% capture fr %}{% include_relative french.txt %}{% endcapture %}
{% capture li %}{% include_relative literal.txt %}{% endcapture %}
{% capture en %}{% include_relative original.txt %}{% endcapture %}
{% include poem-parallel.html
   col1=fr label1="French" lang1="fr"
   col2=li label2="Literal English"
   col3=en label3="Traditional English" %}
