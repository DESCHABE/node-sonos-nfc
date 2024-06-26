forked from https://github.com/ryanolf/node-sonos-nfc, made several changes to work locally in my environment (drive LEDs and Buttons of my local Box) and some adjustments to fit to my needs (max_volume, pause and play when a card is removed and reattached).

The following introduction has not been changed:

# Install

## You need a computer

The basic setup here involves a PC/SC card reader attached to a computer on the same network as your Sonos. The computer could be any computer that runs Node.js (so, any computer) and has drivers available for your card reader (depends on the card reader). If you have the ACR122U, you can use pretty much any computer with USB and networking capability. A popular option if you don't want to hook up to an existing computer is to purchase a Raspberry Pi. I _think_ pretty much any model will do if it can properly power the card reader. I've used a version 3 and 4. There is a super cheap and tiny Pi Zero that could probably run the software but may struggle to source enough power for the card reader when it's actually reading cards. Check out [the Raspberry Pi documentation](https://www.raspberrypi.org/documentation/) if you want to setup a Raspberry Pi.

## Card reader setup

This program uses the [nfc-pcsc] library to read (and someday?) write to PC/SC compatible smart card readers. The library is tested with the ACR122U but _should_ work with any PC/SC compatible reader. Instructions here are mainly focused on ACR122U because that's what has been tested.

Make sure your card reader can be detected by your system by installing drivers as needed. For ACR122U on Ubuntu/Debian/Raspberry Pi OS:

```
$ sudo apt install libacsccid1
```

You also need to make sure your computer can speak PC/SC. In Ubuntu/Debian, install PC/SC libraries and daemon. You'll need to have a suitable build environment setup, e.g. have gcc installed. See the [node-pcsclite](https://github.com/pokusew/node-pcsclite) instructions if you have any issues.

```
$ sudo apt install libpcsclite1 libpcsclite-dev pcscd
```

If you're running a version of Linux, your computer may try to use the nfc kernel module to talk to tyour ACR122U. You don't want it to do this, so make sure the nfc and enabling modules are not loaded. In Ubuntu/Debian/Raspberry Pi OS, blacklist pn533, pn533_usb, nfc modules so that they don't hijack the card reader.

```
$ printf '%s\n' 'pn533' 'pn533_usb' 'nfc' | sudo tee /etc/modprobe.d/blacklist-nfc.conf
```

To make sure everything is square, it's probably a good idea to reboot. In Ubuntu/Debian/Raspberry Pi OS:

```
$ sudo reboot
```

## Setup Node

Install node and npm, e.g. download or follow the [official instructions](https://nodejs.org/en/download/),
so that you can run this code. On Ubuntu/Debian/Raspberry Pi OS, I do this:

```
$ curl -sL https://deb.nodesource.com/setup_15.x | sudo -E bash -
$ sudo apt-get install -y nodejs
```

## Setup this code

Install git and clone this repo. In Ubuntu/Debian/Raspberry Pi OS,

```
$ sudo apt install git
$ git clone https://github.com/ryanolf/node-sonos-nfc.git
```

Install dependencies via `npm`. If you're following along in Ubuntu/Debian/Raspberry Pi OS, the commands are

```
$ cd node-sonos-nfc
$ npm install
```

For simplicity, [sonos-http-api](https://github.com/jishi/node-sonos-http-api), needed for this program to work, is included as a dependency, though you don't need to use it if you already have an http api running elsewhere.

## Run all the time

To run continuously and at boot, you'll want to run under some supervisor program. There are lots of options, like systemd (built-in already), supervisord, and pm2. I have found pm2, recommended by the author of Vinyl Emulator, to be very easy to use. To have pm2 spin-up sonos_nfc at boot and keep it
running, install pm2 globally:

```
$ sudo npm install -g pm2
```

and spin-up sonos_nfc and sonos-http-api:

```
$ pm2 start npm -- run start-all
```

Then, to configure your system to run the startup, follow the instructions given when you run

```
$ pm2 startup
```

e.g.

```
$ sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
```

If you already have the http API running elsewhere, you can direct this program to that server via the `usersettings.json` and instead run just this program via `npm start`, so replace the `pm2 start` command above with

```
$ pm2 start npm -- start
```

## Debug

You can monitor the process output to see what's going on. If you're using pm2, you can see the process output via

```
$ pm2 log
```

# Programming cards

## Card record format

The cards are programmed per the instructions at [Sonos Vinyl Emulator](https://github.com/hankhank10/vinylemulator). One minor difference with this program compared to Vinyl Emulator is that this program turns off shuffle, repeat, and crossfade whenever new music is queued by default. This is configurable in `usersettings.json`, you can turn off this behaviour by adding and/or setting `reset_repeat`, `reset_shuffle` and, `reset_crossfade` parameters to False. You can also enable cross fade, shuffle, or repeat on a card-by-card basis by adding records to enable these features to the card.

## Writing cards

You can probably use the card reader/writer you plan to use to write the cards using software like [NFC Tools](https://www.wakdev.com/en/apps/nfc-tools-pc-mac.html) on your Mac or PC. I like to use my iPhone. Most modern smartphones can read and write NFC with the right app.

It's important that before you write, the card is properly erased and formatted. On my iPhone, I format the cards for NDEF using "NXP Tagwriter." Once the cards are formatted, I use NFC Tools on iOS to write the record(s).
