#!/bin/bash
# Build, package, and install extension locally with auto-reload
#
# Usage: ./scripts/build-local.sh [OPTIONS]
#
# OPTIONS:
#   --editor=code|cursor    Force specific editor (default: auto-detect)
#   --no-reload             Skip automatic window reload
#   --help                  Show this help message
#
# ENVIRONMENT VARIABLES:
#   CODETOGRAPHER_EDITOR    Same as --editor
#   CODETOGRAPHER_NO_RELOAD Set to 1 to skip reload
#
# Examples:
#   pnpm build:local                    # Auto-detect editor, auto-reload
#   pnpm build:local --editor=cursor    # Force Cursor
#   pnpm build:local --no-reload        # Skip auto-reload

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Defaults
EDITOR=""
AUTO_RELOAD="true"

# Parse arguments
show_help() {
    sed -n '2,17p' "$0" | sed 's/^# //' | sed 's/^#//'
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --editor=*)
            EDITOR="${1#*=}"
            shift
            ;;
        --no-reload)
            AUTO_RELOAD="false"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Apply environment variable overrides
[ -n "$CODETOGRAPHER_EDITOR" ] && EDITOR="$CODETOGRAPHER_EDITOR"
[ "$CODETOGRAPHER_NO_RELOAD" = "1" ] && AUTO_RELOAD="false"

# Detect package manager based on lockfile
detect_pkg_manager() {
    if [ -f "$ROOT_DIR/pnpm-lock.yaml" ] && command -v pnpm &> /dev/null; then
        echo "pnpm"
    elif [ -f "$ROOT_DIR/yarn.lock" ] && command -v yarn &> /dev/null; then
        echo "yarn"
    else
        echo "npm"
    fi
}

# Detect which editor is running
detect_editor() {
    # Check if explicitly set
    if [ -n "$EDITOR" ]; then
        echo "$EDITOR"
        return
    fi

    # macOS detection via running processes
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if pgrep -x "Cursor" > /dev/null 2>&1; then
            echo "cursor"
        elif pgrep -x "Code" > /dev/null 2>&1 || pgrep -f "Visual Studio Code" > /dev/null 2>&1; then
            echo "code"
        else
            echo "code"  # Default to VS Code
        fi
    else
        # Linux - check processes
        if pgrep -f "cursor" > /dev/null 2>&1; then
            echo "cursor"
        else
            echo "code"
        fi
    fi
}

# Reload the editor window using macOS accessibility
reload_editor() {
    local editor="$1"

    if [ "$AUTO_RELOAD" = "false" ]; then
        echo ""
        echo "Extension installed. To reload:"
        echo "  Press Cmd+Shift+P (Ctrl+Shift+P) > 'Reload Window'"
        return 0
    fi

    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo ""
        echo "Auto-reload only supported on macOS."
        echo "Please reload manually: Ctrl+Shift+P > 'Reload Window'"
        return 0
    fi

    local app_name="Visual Studio Code"
    [ "$editor" = "cursor" ] && app_name="Cursor"

    echo "Reloading $app_name window..."

    # Try the reload - osascript uses System Events which requires Accessibility permission
    if osascript -e "tell application \"$app_name\" to activate" \
                 -e 'delay 0.2' \
                 -e 'tell application "System Events" to keystroke "p" using {command down, shift down}' \
                 -e 'delay 0.3' \
                 -e 'tell application "System Events" to keystroke "Reload Window"' \
                 -e 'delay 0.2' \
                 -e 'tell application "System Events" to key code 36' 2>/dev/null; then
        echo "Window reloaded."
    else
        echo ""
        echo "Auto-reload requires macOS Accessibility permission."
        echo ""
        echo "To enable (one-time setup):"
        echo "  1. Open System Settings > Privacy & Security > Accessibility"
        echo "  2. Click '+' and add your terminal app (Terminal, iTerm, Warp, etc.)"
        echo "  3. Enable the checkbox next to it"
        echo "  4. Run this script again"
        echo ""
        echo "Or reload manually: Cmd+Shift+P > 'Reload Window'"
        echo ""
        echo "To skip auto-reload in the future, use: pnpm build:local --no-reload"
    fi
}

# Main execution
cd "$ROOT_DIR"

PKG_MGR=$(detect_pkg_manager)
DETECTED_EDITOR=$(detect_editor)

echo "Editor: $DETECTED_EDITOR"
echo "Package manager: $PKG_MGR"
echo ""

# Check vsce is installed
if ! command -v vsce &> /dev/null; then
    echo "Error: vsce not found."
    echo ""
    echo "Run setup first:"
    if [ "$PKG_MGR" = "pnpm" ]; then
        echo "  pnpm setup"
    else
        echo "  $PKG_MGR run setup"
    fi
    exit 1
fi

echo "Building extension..."
if [ "$PKG_MGR" = "pnpm" ]; then
    pnpm build
elif [ "$PKG_MGR" = "yarn" ]; then
    yarn build
else
    npm run build
fi

echo ""
echo "Packaging extension..."
cd extension
vsce package --no-dependencies --allow-missing-repository --skip-license

# Find the .vsix file
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    echo "Error: No .vsix file found"
    exit 1
fi

echo ""
echo "Installing $VSIX_FILE..."
$DETECTED_EDITOR --install-extension "$VSIX_FILE" --force

# Clean up
rm -f "$VSIX_FILE"

echo ""
reload_editor "$DETECTED_EDITOR"

echo ""
echo "Done!"
