// Cusdis comments — lazy-load script on toggle, resize iframe dynamically
(function () {
  var commentsDetails = document.getElementById('comments-section');
  if (!commentsDetails) return;

  var commentsLoaded = false;

  // Load the Cusdis script only when the details element is opened
  commentsDetails.addEventListener('toggle', function () {
    if (this.open && !commentsLoaded) {
      var script = document.createElement('script');
      script.src = "https://cusdis.com/js/cusdis.es.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      commentsLoaded = true;
    }
  });

  // Resize handler for various Cusdis message formats
  window.addEventListener('message', function (e) {
    if (!e.data) return;

    var height = null;

    // Handle various Cusdis message formats
    if (e.data.from === 'cusdis' && e.data.data) {
      height = e.data.data;
    } else if (e.data.event === 'resize' && e.data.height) {
      height = e.data.height;
    }

    if (height) {
      var iframe = document.querySelector('#cusdis_thread iframe');
      if (iframe) {
        // Add generous buffer and enforce minimum height
        iframe.style.setProperty('height', Math.max(height + 100, 500) + 'px', 'important');
      }
    }
  });

  // Fallback: use MutationObserver to catch iframe creation and set initial height
  var cusdisContainer = document.getElementById('cusdis_thread');
  if (!cusdisContainer) return;

  var observer = new MutationObserver(function () {
    var iframe = document.querySelector('#cusdis_thread iframe');
    if (iframe) {
      iframe.style.setProperty('min-height', '500px', 'important');
      iframe.style.setProperty('height', '500px', 'important');
      iframe.style.setProperty('max-height', 'none', 'important');
      observer.disconnect();
    }
  });

  observer.observe(cusdisContainer, {
    childList: true,
    subtree: true
  });
})();
