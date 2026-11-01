### "The Fleet" story, chapter 1 "The Inventory": can Ansible reach the three
### neighbourhood centres? Ansible's commands, paths and output are not
### translated.

chapter-inventory = The Inventory
    .resume = Three servers to manage at once: an Ansible inventory, host keys, the right account, then ansible -m ping.

## Files

inventory-email-theo =
    From:    Théo
    To:      you
    Subject: The three neighbourhood centres

    Hello, and welcome!

    The three neighbourhood centres each have their little server: north,
    south and east (north.centres.internal, etc.). Until now we logged
    into each one to do everything three times, and they ended up not
    looking alike any more. We're moving to Ansible: from this machine,
    one command for all three.

    On each centre, the deploy account has your ssh key
    (~/.ssh/id_ed25519) and can use sudo without a password.

    I started in ~/ansible: an ansible.cfg and an inventory. I didn't have
    time to finish or to try it. The first test is:
    ansible centres -m ping
    It must answer "pong" for all three.

    The sudo password on this machine: districts-2027.

    Théo

## Events

inventory-event-without-config =
    "No inventory was parsed": Ansible found neither ansible.cfg nor an
    inventory. It looks for ansible.cfg in the directory you're in, then
    ~/.ansible.cfg, then /etc/ansible/ansible.cfg. Théo's configuration is
    in ~/ansible: go there (cd ~/ansible).
inventory-event-key-host =
    "Host key verification failed": Ansible goes through ssh, but never
    asks "Are you sure you want to continue connecting?". A machine whose
    host key isn't in ~/.ssh/known_hosts is refused. Connect once to each
    (ssh deploy@north, check the fingerprint, yes, then exit): the key is
    recorded, and Ansible will get through.
inventory-event-account =
    "theo@…: Permission denied": Ansible connects with the remote_user
    account from ansible.cfg, theo, which doesn't exist on the centres.
    The account with your key is deploy (or ansible_user in the inventory,
    or -u deploy for a single command).
inventory-event-missing =
    Everyone in the inventory answers "pong"… but the inventory only knows
    two of them. Théo talked about three neighbourhood centres:
    ansible-inventory --graph shows what Ansible read.
inventory-event-end =
    north, south and east answer "pong": Ansible reaches all three, with
    the right account and verified host keys. Théo: "One command for three
    servers, we're there!"

    Well done! You have finished the chapter "The Inventory".

    WHAT HAPPENED
    Ansible installs nothing on the servers: it connects over ssh, with an
    account and a key, and runs small programs there (the modules). The
    inventory says which machines it manages, sorted into groups
    ([centres]); ansible.cfg, read from the current directory, says where
    the inventory is and which account to connect with. ping doesn't do a
    network ping: it checks that Ansible can connect and run a module.

    GOOD PRACTICE
    - Check host keys (known_hosts) rather than turning checking off
      (host_key_checking = False): that's what protects you from a machine
      pretending to be another.
    - A dedicated account (deploy), with a key, and sudo for what needs
      root (become).
    - ansible-inventory --graph to see what Ansible understood of the
      inventory.

    DOCUMENTATION
    - The inventory: https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
    - Connections: https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html
    - The ping module: https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ping_module.html
