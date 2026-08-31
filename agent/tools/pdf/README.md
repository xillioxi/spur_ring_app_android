# pdf

用本机 Chrome/Chromium 把一页 HTML 打成 PDF（`page.printToPDF` 同源能力）。

中文走系统字体（Linux：`Noto Sans SC` / `Noto Sans CJK SC`；macOS：苹方）。Chromium 只把用到的字形嵌进文件，一页纯文字应是几十到几百 KB，而不是整份 Noto（约 7–10MB）。

需要本机有 Chrome，或设置 `SPUR_CHROME`。Linux 示例：`yum install -y chromium` 或安装 `google-chrome-stable`。
