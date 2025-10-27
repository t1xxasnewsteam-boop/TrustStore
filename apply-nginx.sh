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
        # Найдем конфигурацию сайта
        send "ls -la /etc/nginx/sites-available/ | grep -E 'trust|default'\n"
        
        expect "# "
        send "CONF_FILE=\\\$(ls /etc/nginx/sites-available/ | grep -E 'truststore' | head -1)\n"
        
        expect "# "
        send "if \[ -z \\\"\\\$CONF_FILE\\\" \]; then CONF_FILE='default'; fi\n"
        
        expect "# "
        send "echo \\\"Using config: \\\$CONF_FILE\\\"\n"
        
        expect "# "
        send "cp /etc/nginx/sites-available/\\\$CONF_FILE /etc/nginx/sites-available/\\\${CONF_FILE}.backup\n"
        
        expect "# "
        send "echo 'Backup created!'\n"
        
        expect "# "
        # Показываем текущую конфигурацию
        send "cat /etc/nginx/sites-available/\\\$CONF_FILE | head -30\n"
        
        expect "# "
        send "exit\n"
    }
}

expect eof
