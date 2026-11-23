# RentBot form helper

A userscript that fills in flat application forms with the answers from the
RentBot Telegram bot. You check them, solve the captcha and send yourself;
the script never submits anything.

- `rentbot-helper.html`: install steps (`#install`), self-test (`#test`) and
  the hand-over page for fill links (`#f=…`, answers only in the URL fragment).
- `rentbot-helper.user.js`: the userscript (Violentmonkey / Tampermonkey,
  Userscripts on iOS).

Source of truth: `helper/` in the bot's repository; copy changes here and
bump `@version`.
