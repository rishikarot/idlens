from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,os
from functools import partial
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
server=ThreadingHTTPServer(('127.0.0.1',8958), partial(SimpleHTTPRequestHandler,directory=root))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':410,'height':890})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(open(os.path.join(root,'index.html')).read(),wait_until='domcontentloaded')
  page.add_script_tag(content="Object.defineProperty(window,'localStorage',{value:{_db:{},getItem(k){return this._db[k]||null},setItem(k,v){this._db[k]=String(v)},removeItem(k){delete this._db[k]}}})")
  page.add_script_tag(content=open(os.path.join(root,'liveness-core.js')).read())
  page.add_script_tag(content=open(os.path.join(root,'blink-core.js')).read())
  page.add_script_tag(content=open(os.path.join(root,'app.js')).read())
  page.wait_for_timeout(400)
  assert page.locator('#act_blink').is_checked()
  page.locator('#act_blink').uncheck()
  assert not page.locator('#act_blink').is_checked()
  print('status after uncheck:',page.locator('#actionSafety').inner_text(), 'errors',errors)
  assert '4/5' in page.locator('#actionSafety').inner_text()
  page.locator('#resetActions').click()
  assert page.locator('#act_blink').is_checked()
  assert 'all five' in page.locator('#actionSafety').inner_text()
  assert page.locator('#overlayTitle').count()==1
  page.screenshot(path='/mnt/data/ID_Lens_v3_4_0_mobile_preview.png',full_page=True)
  print('UI smoke PASSED, page errors:',errors)
  browser.close()
finally:server.shutdown()
