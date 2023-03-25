import {NFC} from 'nfc-pcsc'
import onoff from 'onoff'
import RPiGPIOButtons from 'rpi-gpio-buttons'
import {default as nfcCard} from 'nfccard-tool'
import process_sonos_command from './lib/process_sonos_command.js'
import {get_sonos_information} from './lib/get_sonos_information.js'
import {get_sonos_room_information} from './lib/get_sonos_information.js'
import {get_available_sonos_room} from './lib/get_sonos_information.js'
import fs from 'fs'

var {max_volume} = JSON.parse(fs.readFileSync('usersettings.json', 'utf-8'))

const nfc = new NFC()

var lasttag = "";

console.log("Control your Sonos with NFC cards. Searching for PCSC-compatible NFC reader devices...")

//4 +
//17 -
//27 <-
//22 ->
let buttons = new RPiGPIOButtons({
	pins: [4, 17, 27, 22],
	timing: { debounce: 220 }
});

//GPIO 27 22 = 13/15
const Gpio = onoff.Gpio
const LED_volUp = new Gpio(6, 'out');
const LED_volDown = new Gpio(13, 'out');
const LED_lastTrack = new Gpio(19, 'out');
const LED_nextTrack = new Gpio(26, 'out');
const LED_power = new Gpio(5, 'out');

buttons
.on('error', error => {
  console.log('BUTTON-ERROR', error);
})
.on('debug', debug => {
  //console.log('BUTTON-DEBUG', debug);
})
.on('clicked', function (pin) {
  switch(pin) {
    case PIN_UP:
        console.log('UP');
    break;

    case PIN_DOWN:
        console.log('DOWN');
    break;
  }
})
.on('button_event', async (type, pin) => {
  console.log(`button_event ${type} on ${pin}`)
  switch(type){
    case 'released':
	var playerState = await get_sonos_room_information("state")
	switch(pin){
	    case 4:
		if (playerState['volume'] <= max_volume){
			await process_sonos_command('command:volume/+3')
		}
	    break;
	    case 17:
		await process_sonos_command('command:volume/-3')
	    break;
	    case 27:
		//only possible if player is playing and queue is more than 1 and title is not 1 in queue
		var queue = await get_sonos_room_information("queue")
		console.log('check conditions')
		console.log('current track: ' + playerState['currentTrack']['title'] + ',first track in queue: ' + queue[0]['title'])
		console.log('queue length: ' +Object.keys(queue).length)
		console.log('player state: ' + playerState['playbackState'])
		if (playerState['currentTrack']['title'] != queue[0]['title'] && Object.keys(queue).length > 1 && playerState['playbackState'] == 'PLAYING'){
			await process_sonos_command('command:previous')
		}
	    break;
	    case 22:
		//only possible if player is playing and next track available
		console.log('check conditions')
		console.log('next track: ' + playerState['nextTrack']['artist'])
		console.log('player state: ' + playerState['playbackState'])
		if (playerState['nextTrack']['artist'] != '' && playerState['playbackState'] == 'PLAYING'){
			await process_sonos_command('command:next')
		}
	    break;
	  } 
	  break;
    case 'pressed':
	break;  
  }
});

buttons.init()
.catch(error => {
console.log('BUTTON-INIT ERROR', error.stack);
process.exit(1);
});
    
nfc.on('reader', reader => {

    console.log(`${reader.reader.name} device attached`)
    
    reader.on('card', async card => {

        // card is object containing following data
        // String standard: TAG_ISO_14443_3 (standard nfc tags like MIFARE Ultralight) or TAG_ISO_14443_4 (Android HCE and others)
        // String type: same as standard
        // Buffer atr

        console.log(`${reader.reader.name} detected %s with UID %s`, card.type, card.uid)

        try {
            /**
             *  1 - READ HEADER
             *  Read from block 0 to block 4 (20 bytes length) in order to parse tag information
             *  Block 4 is the first data block -- should have the TLV info
             */
            const cardHeader = await reader.read(0, 20)
      
            const tag = nfcCard.parseInfo(cardHeader)
            // console.log('tag info:', JSON.stringify(tag))
      
            /**
             *  2 - Read the NDEF message and parse it if it's supposed there is one
             *  The NDEF message must begin in block 4 -- no locked bits, etc.
             *  Make sure cards are initialized before writing.
             */

            if(nfcCard.isFormatedAsNDEF() && nfcCard.hasReadPermissions() && nfcCard.hasNDEFMessage()) {
      
                // Read the appropriate length to get the NDEF message as buffer
                const NDEFRawMessage = await reader.read(4, nfcCard.getNDEFMessageLengthToRead()) // starts reading in block 0 until end
      
                // Parse the buffer as a NDEF raw message
                const NDEFMessage = nfcCard.parseNDEF(NDEFRawMessage)
      
                // console.log('NDEFMessage:', NDEFMessage)
                
                for (const record of NDEFMessage) {
                    let service_type, sonos_instruction
                    switch (record.type) {
                        case 'uri':
                            record.text = record.uri
                        case 'text':
                            const received_text = record.text
                            console.log('Read from NFC tag with message: ', received_text)
                            console.log('lasstag was: ', lasttag)
                            LED_volUp.writeSync(1)
                            LED_volDown.writeSync(1)
                            LED_lastTrack.writeSync(1)
                            LED_nextTrack.writeSync(1)
                            if (lasttag == received_text){
                                console.log('NFC tag text is the same like last tag - change to command:playpause')
                                await process_sonos_command('command:play')
                            }else{
                                lasttag = received_text
				await process_sonos_command(received_text)
                            }                   
                    }
                }
      
            } else {
              console.log('Could not parse anything from this tag: \n The tag is either empty, locked, has a wrong NDEF format or is unreadable.')
            }
            
        } catch (err) {
            console.error(err.toString())
        }   
    })
    
    reader.on('card.off', async card => {	
        console.log(`${reader.reader.name}: %s with UID %s removed`, card.type, card.uid)
        console.log('pause what we have been playing')
        try{
            LED_volUp.writeSync(0)
            LED_volDown.writeSync(0)
            LED_lastTrack.writeSync(0)
            LED_nextTrack.writeSync(0)
            await process_sonos_command('command:pause')
        }catch (err) {
            console.error(err.toString())
        }  
    })

    reader.on('error', async err => {
        console.log(`${reader.reader.name} an error occurred`, err)        
        console.log('pause what we have been playing')
        try{
            LED_volUp.writeSync(0)
            LED_volDown.writeSync(0)
            LED_lastTrack.writeSync(0)
            LED_nextTrack.writeSync(0)
            await process_sonos_command('command:pause')
        }catch (err) {
            console.error(err.toString())
        }  
    })

    reader.on('end', async () => {
        console.log(`${reader.reader.name}  device removed`)
        console.log('pause what we have been playing')
        try{
            LED_volUp.writeSync(0)
            LED_volDown.writeSync(0)
            LED_lastTrack.writeSync(0)
            LED_nextTrack.writeSync(0)
            await process_sonos_command('command:pause')
        }catch (err) {
            console.error(err.toString())
        }  
    })

})

nfc.on('error', async err => {
    console.log('an NFC error occurred', err)
    console.log('pause what we have been playing')
    try{
        LED_volUp.writeSync(0)
	LED_volDown.writeSync(0)
	LED_lastTrack.writeSync(0)
	LED_nextTrack.writeSync(0)
        await process_sonos_command('command:pause')
    }catch (err) {
        console.error(err.toString())
    }  
})

function Sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
   }

//wait a litte until sonos-api is available and output some information
try{
    await Sleep(5000) 
    let room = await get_available_sonos_room()
    console.log('playing music on available room:' + room)
    LED_power.writeSync(1);
}catch (err) {
    console.error(err.toString())
}  
