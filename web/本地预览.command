#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
	osascript -e 'display dialog "未找到 Node.js，无法启动本地预览。" buttons {"确定"} default button "确定" with icon stop'
	exit 1
fi
exec node "./本地预览.mjs" "."
