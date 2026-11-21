// Service worker: permite usar o app offline. Estratégia "rede primeiro, cache como reserva".
const CACHE = 'prof-v15';
const ARQUIVOS = [
  './', 'index.html', 'privacidade.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/pix-qr.svg',
  'css/app.css', 'css/editor.css', 'css/print.css',
  'js/app.js', 'js/ui.js', 'js/ia.js', 'js/anexos.js', 'js/conta.js', 'js/apoie.js', 'js/sincronizacao.js', 'js/configuracoes.js', 'js/db.js', 'js/editor.js', 'js/editor-ui.js', 'js/editor-tabela.js', 'js/editor-imagem.js', 'js/ribbon.js', 'js/cabecalho.js', 'js/fmt-controles.js', 'js/formato-pagina.js', 'js/questoes.js', 'js/avaliacoes.js',
  'js/gabaritos.js', 'js/leitor.js', 'js/omr-layout.js', 'js/omr-reader.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && (new URL(e.request.url).origin === location.origin || /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(e.request.url))) {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
