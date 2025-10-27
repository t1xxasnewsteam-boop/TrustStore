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
        send "cat /etc/nginx/sites-available/truststore\n"
        expect "# "
        send "echo '---ENABLED---'\n"
        expect "# "
        send "cat /etc/nginx/sites-enabled/truststore\n"
        expect "# "
        send "exit\n"
    }
}

expect eof
