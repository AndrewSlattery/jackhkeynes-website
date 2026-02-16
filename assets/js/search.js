// Cryptics index — Simple Jekyll Search initialization
document.addEventListener('DOMContentLoaded', function () {
  var baseurl = document.getElementById('search-input').getAttribute('data-baseurl') || '';
  new SimpleJekyllSearch({
    searchInput: document.getElementById('search-input'),
    resultsContainer: document.getElementById('results-container'),
    json: baseurl + '/search.json',
    searchResultTemplate: '<li><span class="result-date">{date}</span><a href="{url}">{title}</a></li>',
    noResultsText: '<li style="color:#828282; padding:10px;">No matches found</li>',
    limit: 10,
    fuzzy: false
  });
});
