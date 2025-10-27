#!/usr/bin/expect -f

set timeout 30
set password "o-4zWa6SFWUGo,"

spawn ssh root@45.95.234.173

expect {
    "password:" {
        send "$password\r"
        exp_continue
    }
    "# " {
        # Создаем новую конфигурацию
        send "cat > /tmp/nginx-location.conf << 'EOF'\n"
        send "    # Убираем .html из URL\n"
        send "    location / {\n"
        send "        try_files \\\$uri \\\$uri.html \\\$uri/ =404;\n"
        send "        \n"
        send "        if (\\\$request_uri ~ ^/(.*)\\.html\\\$) {\n"
        send "            return 301 /\\\$1;\n"
        send "        }\n"
        send "    }\n"
        send "    \n"
        send "    # Для корневой страницы\n"
        send "    location = / {\n"
        send "        try_files /main.html /index.html =404;\n"
        send "    }\n"
        send "EOF\n"
        
        expect "# "
        send "cat /tmp/nginx-location.conf\n"
        
        expect "# "
        send "echo 'Конфигурация создана!'\n"
        
        expect "# "
        send "exit\n"
    }
}

expect eof
