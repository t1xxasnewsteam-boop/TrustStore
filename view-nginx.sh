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
        send "cat /etc/nginx/sites-available/truststore.ru\n"
        expect "# "
        send "exit\n"
    }
}

expect eof
