#!/bin/bash
# Script de diagnostic pour Dancing Dead API sur O2Switch

echo "========================================="
echo "   DIAGNOSTIC DANCING DEAD API"
echo "========================================="
echo ""

echo "=== 1. NODE VERSION ==="
node --version
echo ""

echo "=== 2. NPM VERSION ==="
npm --version
echo ""

echo "=== 3. GIT BRANCH ==="
git branch
echo ""

echo "=== 4. GIT STATUS ==="
git status
echo ""

echo "=== 5. FICHIERS CRITIQUES ==="
echo "Checking app.js..."
if [ -f "app.js" ]; then
    echo "✓ app.js exists"
    ls -lh app.js
else
    echo "✗ app.js NOT FOUND"
fi

echo ""
echo "Checking .passenger..."
if [ -f ".passenger" ]; then
    echo "✓ .passenger exists"
    cat .passenger
else
    echo "✗ .passenger NOT FOUND"
fi

echo ""
echo "Checking .env..."
if [ -f ".env" ]; then
    echo "✓ .env exists"
    echo "Size: $(wc -l < .env) lines"
else
    echo "✗ .env NOT FOUND - CRITICAL!"
fi

echo ""
echo "Checking package.json..."
if [ -f "package.json" ]; then
    echo "✓ package.json exists"
else
    echo "✗ package.json NOT FOUND"
fi

echo ""

echo "=== 6. NODE_MODULES ==="
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
    echo "Modules installed: $(ls node_modules | wc -l)"
else
    echo "✗ node_modules NOT FOUND"
    echo "Run: npm install --production"
fi

echo ""

echo "=== 7. TEST SYNTAXE APP.JS ==="
if [ -f "app.js" ]; then
    node -c app.js 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ app.js syntax is valid"
    else
        echo "✗ app.js has syntax errors!"
    fi
fi

echo ""

echo "=== 8. PERMISSIONS ==="
ls -la | grep -E "app.js|.env|.passenger|index.js"

echo ""

echo "=== 9. DERNIERES ERREURS PASSENGER ==="
if [ -f "$HOME/logs/error_log" ]; then
    echo "Last 20 lines of error log:"
    tail -20 ~/logs/error_log
else
    echo "Error log not found at ~/logs/error_log"
fi

echo ""

echo "=== 10. RESTART PASSENGER ==="
mkdir -p tmp
touch tmp/restart.txt
echo "✓ Passenger restart triggered (tmp/restart.txt created)"

echo ""
echo "========================================="
echo "   DIAGNOSTIC COMPLETE"
echo "========================================="
echo ""
echo "Envoyez tout ce résultat à Claude pour analyse!"
