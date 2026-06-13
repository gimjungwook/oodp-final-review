#!/usr/bin/env bash
# 폰트 통일 검증 — Pretendard 외 폰트가 남아 있으면 FAIL.
# 사용: bash scripts/verify-fonts.sh
set -u
cd "$(dirname "$0")/.."
fail=0
echo "🔤 폰트 통일 검증 (Pretendard)"
echo "------------------------------------"

g=$(grep -rn "Geist" . --include='*.html' --include='*.css' --include='*.js' 2>/dev/null)
if [ -n "$g" ]; then echo "❌ 'Geist' 잔존:"; echo "$g"; fail=1; else echo "✅ 'Geist' 0건"; fi

hc=$(grep -rniE "font-family[ ]*:" . --include='*.html' --include='*.css' 2>/dev/null \
  | grep -viE "var\(--|@font-face|pretendard|inherit")
if [ -n "$hc" ]; then echo "❌ 하드코딩 font-family (var/Pretendard 외):"; echo "$hc"; fail=1; else echo "✅ 하드코딩 font-family 0건"; fi

cf=$(grep -rnoE "\.font[ ]*=[ ]*['\"][^'\"]+['\"]" . --include='*.html' --include='*.js' 2>/dev/null \
  | grep -iE "monospace|serif|arial|menlo|courier|helvetica|georgia|times" | grep -vi pretendard)
if [ -n "$cf" ]; then echo "❌ canvas .font 비-Pretendard:"; echo "$cf"; fail=1; else echo "✅ canvas .font 클린"; fi

v=$(grep -hE "\-\-(serif|sans|mono)[ ]*:" assets/*.css 2>/dev/null | grep -vi pretendard)
if [ -n "$v" ]; then echo "❌ 폰트 변수 비-Pretendard:"; echo "$v"; fail=1; else echo "✅ --serif/--sans/--mono 전부 Pretendard"; fi

echo "------------------------------------"
if [ $fail -eq 0 ]; then echo "🎉 PASS — 전부 Pretendard"; else echo "💥 FAIL — 위 항목 수정 필요"; exit 1; fi
