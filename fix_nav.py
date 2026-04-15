content = open('/var/www/html/wp-content/plugins/meudiva-integration/meudiva-integration.php').read()

# 1. Nav maior e bold
content = content.replace(
    'font-size: 0.875rem;\n    font-weight: 500;\n    color: rgba(255,255,255,0.8);\n    text-decoration: none;\n    border-radius: 8px;\n    transition: all 0.2s;\n    font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;\n}\n#meudiva-nav > a:hover',
    'font-size: 1rem;\n    font-weight: 600;\n    color: rgba(255,255,255,0.9);\n    text-decoration: none;\n    border-radius: 8px;\n    transition: all 0.2s;\n    font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;\n    letter-spacing: 0.01em;\n}\n#meudiva-nav > a:hover'
)

# 2. Nav mais à direita - aumenta gap entre logo e nav
content = content.replace(
    'justify-content: space-between;\n}',
    'justify-content: space-between;\n}\n#meudiva-nav { margin-left: auto; margin-right: 24px; }',
    1
)

# 3. Rodape links em duas colunas
content = content.replace(
    '<ul>',
    '<ul style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">',
    1
)

open('/var/www/html/wp-content/plugins/meudiva-integration/meudiva-integration.php', 'w').write(content)
print('OK')
