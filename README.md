# RentBot form helper

A userscript that fills in flat application forms with the answers from the
RentBot Telegram bot. You check them, solve the captcha and send yourself;
the script never submits anything.

- `rentbot-helper.html`: install steps (`#install`), self-test (`#test`) and
  the hand-over page for fill links (`#f=…`, answers only in the URL fragment).
- `rentbot-helper.user.js`: the userscript (Violentmonkey / Tampermonkey,
  Userscripts on iOS).
- `settings.html`: the bot's settings view (Telegram Mini App on the menu
  button; the settings travel only in the URL fragment, `#rs=…`).
- `plz-map.html`, `plz-berlin.json`: the postcode map picker (Mini App).

Source of truth: `helper/` in the bot's repository; copy changes here and
bump the version in three places: `@version` and `VERSION` in the script,
and `<meta name="rentbot-helper-version">` in the page. The page tells older
scripts that an update is out (on the form page and on `#install`/`#test`).
