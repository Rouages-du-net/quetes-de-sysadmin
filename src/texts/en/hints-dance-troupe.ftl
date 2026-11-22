### Graded hints for The Dance Troupe (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Public Bucket

hint-public-bucket-exposed =
    .lead = See for yourself what the parent saw: ask for Esperanza's link from the command line, without any key (man curl).
    .solution = curl https://www.kestrel.example/members/medical-contacts-2032.csv
hint-public-bucket-website =
    .lead = Which bucket holds the website, and what lets anyone read it? Garage's CLI describes a bucket (it needs sudo).
    .solution = sudo garage bucket list, then sudo garage bucket info www.kestrel.example (look at "Website access")
hint-public-bucket-moved =
    .lead = Create a bucket without website access for the documents, give the admin key rights on it, and move the members/ objects there with the AWS CLI (man garage, man aws).
    .solution = sudo garage bucket create members; sudo garage bucket allow --read --write --owner members --key troupe-admin; aws s3 mv s3://www.kestrel.example/members/ s3://members/ --recursive
hint-public-bucket-closed =
    .lead = Check the document's old public address again, from the outside.
    .solution = curl -i https://www.kestrel.example/members/medical-contacts-2032.csv (it should answer 404)
hint-public-bucket-deploy-key =
    .lead = Make a key for the deploy only, allow it to read and write the website's bucket and nothing else, put it in the deploy profile of ~/.aws/credentials, and run the deploy script.
    .solution = sudo garage key create site-deploy; sudo garage bucket allow --read --write www.kestrel.example --key site-deploy; aws configure set aws_access_key_id GK… --profile deploy (and the secret); ~/bin/deploy-site
hint-public-bucket-backup-key =
    .lead = The same for the office backup: its own key, read and write on backups only, in /etc/rclone/office.conf; then try it with rclone.
    .solution = sudo garage key create office-backup; sudo garage bucket allow --read --write backups --key office-backup; sudo nano /etc/rclone/office.conf (access_key_id, secret_access_key); sudo rclone --config /etc/rclone/office.conf ls garage:backups
hint-public-bucket-end =
    .lead = Check each part: the documents only in a private bucket, the site still served, each tool's key limited to its bucket and tried.
    .solution = sudo garage bucket info www.kestrel.example; sudo garage key info site-deploy; ~/bin/deploy-site; sudo rclone --config /etc/rclone/office.conf ls garage:backups

## Chapter 2 — The Offsite Copy

hint-offsite-copy-failing =
    .lead = Why did last night's backup fail? The service's output is in the journal.
    .solution = journalctl -u office-backup (or sudo /usr/local/bin/office-backup)
hint-offsite-copy-clock =
    .lead = Compare wings' date with the date of Linh's message; then look at how the machine keeps its time (man timedatectl).
    .solution = date; timedatectl; sudo timedatectl set-ntp true
hint-offsite-copy-region =
    .lead = Run the backup again and read the new error: the scope it expected names the region Garage wants.
    .solution = sudo nano /etc/rclone/office.conf: region = garage
hint-offsite-copy-write =
    .lead = Next error: AccessDenied. What may the key office-backup do on backups now? (man garage)
    .solution = sudo garage bucket info backups; sudo garage bucket allow --read --write backups --key office-backup
hint-offsite-copy-restored =
    .lead = The good report is in the bucket, from 2 April: copy that one object back to /srv/office (man rclone, man aws), before any sync replaces it.
    .solution = sudo rclone --config /etc/rclone/office.conf copyto garage:backups/office/grants/arts-council-report-2031.txt /srv/office/grants/arts-council-report-2031.txt
hint-offsite-copy-safe =
    .lead = Make the script keep what sync replaces or deletes, in the same bucket but outside office/ (man rclone: --backup-dir); try it with --dry-run first.
    .solution = sudo nano /usr/local/bin/office-backup: add --backup-dir garage:backups/office-old/$(date +%F) to the rclone line; then sudo rclone --config /etc/rclone/office.conf sync -n /srv/office garage:backups/office --backup-dir garage:backups/office-old/test
hint-offsite-copy-synced =
    .lead = Run the backup for real, the way the timer does.
    .solution = sudo systemctl start office-backup (or sudo /usr/local/bin/office-backup), then journalctl -u office-backup -n 5
hint-offsite-copy-checked =
    .lead = Compare the share and its copy file by file (man rclone).
    .solution = sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office
hint-offsite-copy-end =
    .lead = Check each part: the clock, the configuration, the key, the script, the report, the copy.
    .solution = timedatectl; sudo cat /etc/rclone/office.conf /usr/local/bin/office-backup; sudo rclone --config /etc/rclone/office.conf check /srv/office garage:backups/office

## Chapter 3 — The Big File

hint-big-file-failed-node =
    .lead = Siosaia's machine died: what does the cluster say about its nodes? (man garage)
    .solution = sudo garage status
hint-big-file-safe =
    .lead = Before changing anything, look at the layout: the roles, the zones, the version.
    .solution = sudo garage layout show
hint-big-file-read-key =
    .lead = Make a key for this share only, that can read media and nothing else.
    .solution = sudo garage key create festival-share; sudo garage bucket allow --read media --key festival-share
hint-big-file-shared =
    .lead = Sign a link for the video with that key, for a week at most (man aws: presign, --expires-in in seconds), and write it to the file Farrukh named. A profile for the key keeps it out of your history.
    .solution = aws configure set aws_access_key_id GK… --profile festival (and the secret, region garage, endpoint_url https://s3.kestrel.example); aws --profile festival s3 presign s3://media/videos/spring-gala-2032-full.mp4 --expires-in 604800 > ~/link_for_zuri.txt
hint-big-file-replaced =
    .lead = Give the new node porch's role, in porch's zone (garage layout assign, --replace), look at the staged layout, then apply it with its version.
    .solution = sudo garage layout assign -z home -c 4T NEWID --replace OLDID (the IDs from garage status); sudo garage layout show; sudo garage layout apply --version 4
hint-big-file-end =
    .lead = Check both: the link works from the outside, and the cluster is healthy.
    .solution = curl -I "$(cat ~/link_for_zuri.txt)"; sudo garage status
