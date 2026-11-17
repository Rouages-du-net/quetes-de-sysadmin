### Story "The Night Batch", chapter "Fixed Width": the bureau's EBCDIC
### file, its fixed-width records described by a copybook, and why its packed
### amounts can't go through a text conversion. Commands, paths, record
### layouts and program outputs are not translated.

chapter-copybook = Fixed Width
    .summary = The mainframe's nightly file has landed on Linux and looks like gibberish: read its bytes, its records and its copybook, and convert it without damaging the amounts.

## Shared by the story

night-batch-notes-ramon =
    Ramón's notes - the nightly batch (job NIGHTLY), for whoever comes next

    THE FILE. Every night, the bureau sends the day's contributions:
    /srv/drop/contrib.ebc. It comes from the mainframe as it is: EBCDIC
    (code page 037), fixed records of 40 bytes one after the other, no
    newline (RECFM=FB, LRECL=40). The layout is in copybooks/CONTRIB.cpy:
    a header (H), one record per contribution (D), and a trailer (T) that
    gives the number of contributions and their total. Check it every time.

    THE AMOUNTS are packed decimals (COMP-3): two digits per byte, the sign
    in the last half byte. 42.50 is written 00 00 04 25 0C.

    THE CONVERSION. ebc2asc (in bin/, its source in src/) converts field by
    field, following the copybook. It writes the ASCII file the batch reads
    (copybooks/CONTRIBA.cpy, one record per line):
        bin/ebc2asc EBCDIC-FILE ASCII-FILE

    THE BATCH. src/contrib.cob reads the converted file and writes the
    collection report that accounts sends to the bank. It compiles with
    cobc (GnuCOBOL). It hasn't failed once in thirty years. What failed,
    every time, was what's around it: a file that didn't come, came twice,
    or came cut.

    Ramón

## Files

copybook-email-ayesha =
    From:  Ayesha
    To:    you

    Hello, and thanks for coming to help! For thirty years, our members'
    contributions have been collected by a COBOL program that runs every
    night on the mainframe of a service bureau. The bureau is closing its
    computer room at the end of the month, so the batch is moving here, to
    abacus.

    Ramón wrote those programs in 1994 and retires on Friday. He left
    everything in /opt/batch: his notes (NOTES.txt), the copybooks (the
    description of the records) and the sources. The bureau will keep
    sending us the day's contributions every night, in /srv/drop; last
    night's file is there, contrib.ebc.

    I tried to open it: gibberish. On a forum, they say "iconv -f EBCDIC-US
    -t ASCII", but it stops with an error. Ramón has a converter of his
    own, but before we trust it, I'd like us to understand what's in that
    file.

    Could you put the converted file where the batch will read it,
    /srv/batch/in/contrib.dat, and fill in check.txt? We'll compare
    tonight.

    Ayesha

copybook-check =
    The bureau's file of 21 November - checks before the first night on Linux

    Size of the file, in bytes:
    Number of records (one every 40 bytes):
    Contributions (detail records):
    Control total (in the trailer):

## Events

copybook-event-garbage =
    � and @ everywhere: this isn't text your terminal can read. Its letters
    are EBCDIC, the mainframe's character set: a capital A is the byte 0xC1,
    which isn't valid UTF-8 (�), and the space is 0x40, an @ in ASCII. And
    there is no newline: the records follow each other. Look at its bytes
    (od -c, xxd, hexdump -C) and at its size (wc -c).
copybook-event-data =
    file says "data": no character set it knows. libmagic doesn't recognise
    EBCDIC; the copybook and Ramón's notes say what this is.
copybook-event-records =
    560 bytes: 14 records of 40 bytes (LRECL=40), a header, twelve
    contributions and a trailer. A size that isn't a multiple of the record
    length would mean a file cut short.
copybook-event-bytes =
    The bytes as they are. C8 is an H in EBCDIC, F0 to F9 are the digits, 40
    is the space. But in each record, bytes 34 to 38 (CR-AMOUNT in the
    copybook) are no characters at all: 00 00 04 25 0C is 42.50, packed
    (COMP-3), two digits per byte and the sign at the end (C: positive).
copybook-event-illegal =
    iconv stops at position 75: the 36th byte of the second record, inside
    its amount (bytes 34 to 38). That byte, 0x04, is no character: it's half
    of a packed number. A character set can't make text of what isn't text.
copybook-event-text-converted =
    It went through, but look at the amounts: a text conversion treats every
    byte as a character. From IBM037 to UTF-8, the byte 0x25 (the digits 2
    and 5 of 42.50) became a newline, and the records no longer have 40
    bytes; with dd conv=ascii, the length stays, but 0x04 became 0x9C: the
    amount is lost. Only the text fields may go through a table; the amounts
    must be unpacked. Ramón's notes say how.
copybook-event-wrong-dat =
    /srv/batch/in/contrib.dat isn't what the batch expects: 14 lines of 43
    characters, each amount unpacked with its sign (+000004250). If it comes
    out of iconv or dd, the amounts were damaged on the way. Ramón's notes
    say which tool converts field by field.
copybook-event-converted =
    contrib.dat is right: 14 lines, the text in ASCII, each amount unpacked
    with its sign (+000004250 is 42.50). The last line is the trailer: the
    number of contributions and their control total.
copybook-event-end =
    Ayesha: "So that's what was in there! I'll compare your figures with
    the bureau's tonight. And I won't use iconv on it again."

    Well done! You have finished the chapter "Fixed Width".

    WHAT HAPPENED
    The bureau's file is the mainframe's file as it is: EBCDIC, fixed
    records of 40 bytes with no newline, and amounts in packed decimal. You
    read it with tools that show bytes rather than text (wc -c, od, xxd,
    hexdump), found its layout in the copybook, and saw why a text
    conversion of the whole file damages the amounts: iconv stops on them,
    or turns one of their bytes into a newline; dd conv=ascii changes them
    silently. Ramón's ebc2asc converts field by field: the text through the
    EBCDIC table, the amounts unpacked.

    GOOD PRACTICE
    - Look at the bytes before trusting the name: file, wc -c, od -c, xxd.
    - A record file is read with its description (the copybook): record
      length, the type of each field. The size must be a multiple of the
      record length.
    - Never put binary fields (COMP-3, COMP) through a text conversion:
      convert field by field, or ask the sender for an all-text file
      (amounts in DISPLAY, sign separate).
    - Check with the trailer: the number of records and the control total
      are there for that.

    ANOTHER WAY
    When the file is all text (no COMP-3), dd conv=ascii cbs=80 converts
    fixed records and adds a newline after each; iconv -f IBM037 does the
    same character by character. Some transfer tools (FTP in ASCII mode
    from the mainframe) convert on the way, which is just as dangerous for
    packed fields: transfer in binary, convert on arrival.

    DOCUMENTATION
    - iconv(1): https://man7.org/linux/man-pages/man1/iconv.1.html
    - dd, conv=ascii: https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html
    - od: https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html
    - GnuCOBOL, USAGE COMP-3: https://gnucobol.sourceforge.io/doc/gnucobol.html
