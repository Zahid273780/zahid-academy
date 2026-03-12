const fs = require('fs');
const names = ['bulkimport', 'import-users', 'mcqs', 'publisher', 'rbac', 'subscriptions'];
names.forEach(name => {
  let h = fs.readFileSync(name + '.html', 'utf8');
  h = h.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="' + name + '.css">');
  h = h.replace(/<script>window\.addEventListener\('error',[^<]*<\/script>\s*/g, '');
  const navBack = /<p class="nav" style="margin-bottom:1rem;">\s*<a href="dashboard\.html" style="[^"]+">/;
  if (navBack.test(h)) h = h.replace(navBack, '<p class="nav"><a href="dashboard.html" class="back-link">');
  let scriptStart = h.indexOf('<script type="module">');
  const scriptEnd = h.indexOf('</script>', scriptStart);
  if (scriptStart !== -1 && scriptEnd !== -1) {
    const scriptTag = '<script type="module" src="' + name + '.js"></script>';
    h = h.slice(0, scriptStart) + scriptTag + h.slice(scriptEnd + 9);
  }
  fs.writeFileSync(name + '.html', h);
});
console.log('HTML updated');
