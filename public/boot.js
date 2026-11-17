// Before first paint: mark that JS is running (so the boot sequence can start
// hidden) and apply the saved theme. Without JS neither happens and each page
// is simply a readable, stacked document in the default theme.
//
// A plain, blocking script in <head> on both pages, served from this origin:
// the CSP's script-src 'self' covers it, so there is no inline hash to pin.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
    else if (matchMedia("(prefers-color-scheme: light)").matches)
      root.dataset.theme = "light";
  } catch (e) {}
})();
