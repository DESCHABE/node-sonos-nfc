import fetch from 'node-fetch'
import fs from 'fs'
import {get_available_sonos_room} from './get_sonos_information.js'

var {sonos_http_api} = JSON.parse(fs.readFileSync('usersettings.json', 'utf-8'))

export default async function process_sonos_command(received_text) {
    let service_type, sonos_instruction
    let received_text_lower = received_text.toLowerCase()
    
    if (received_text_lower.startsWith('apple:')) {
        service_type = "applemusic"
        sonos_instruction = "applemusic/now/" + received_text.slice(6)

    } else if (received_text_lower.startsWith('applemusic:')) {
        service_type = "applemusic"
        sonos_instruction = "applemusic/now/" + received_text.slice(11)

    } else if (received_text_lower.startsWith('http')) {
        service_type = "completeurl"
        sonos_instruction = received_text

    } else if (received_text_lower.startsWith('spotify:')) {
        service_type = "spotify"
        sonos_instruction = "spotify/now/" + received_text

    } else if (received_text_lower.startsWith('tunein:')) {
        service_type = "tunein"
        sonos_instruction = "tunein/now/" + received_text

    } else if (received_text_lower.startsWith('amazonmusic:')) {
        service_type = "amazonmusic"
        sonos_instruction = "amazonmusic/now/" + received_text.slice(12)

    } else if (received_text_lower.startsWith('playlist:')) {
        service_type= "sonos_playlist"
        sonos_instruction = "playlist/" + received_text.slice(9)

    } else if (received_text_lower.startsWith('command:')) {
        service_type = "command"
        sonos_instruction = received_text.slice(8)

    } else if (received_text_lower.startsWith('room:')) {
        //sonos_room = received_text.slice(5)
        //console.log("Sonos room changed to %s", sonos_room)
        return
    }  

    if (!service_type) {
        console.log("Service type not recognised. Text should begin " +
            "'spotify', 'tunein', 'amazonmusic', 'apple'/'applemusic', 'command' or 'room'.")
        return
    }

    console.log("Detected '%s' service request", service_type)

    let room
    room = await get_available_sonos_room()

    if (service_type != "command") {
        console.log("Resetting Sonos queue (clear, turn off repeat, shuffle, crossfade)")
        let res
        res = await fetch(sonos_http_api + "/" + room + "/repeat/off")
        if (!res.ok) throw new Error(`Unexpected response while turning repeat off: ${res.status}`)
        await new Promise(resolve => setTimeout(resolve, 200));
        res = await fetch(sonos_http_api + "/" + room + "/shuffle/off")
        if (!res.ok) throw new Error(`Unexpected response while turning shuffle off: ${res.status}`)
        //temporaer ausgebaut wegen fehler
	//res = await fetch(sonos_http_api + "/" + room + "/crossfade/off")
        //if (!res.ok) throw new Error(`Unexpected response while turning crossfade off: ${res.status}`)
        res = await fetch(sonos_http_api + "/" + room + "/clearqueue")
        if (!res.ok) throw new Error(`Unexpected response while clearing queue: ${res.status}`)
    }

    let urltoget
    if (service_type == "completeurl") {
        urltoget = sonos_instruction
    } else {
        urltoget = sonos_http_api + "/" + room + "/" + sonos_instruction
    }

    // Perform the requested action on the sonos API
    console.log("Fetching URL via HTTP api: %s", urltoget)
    const res = await fetch(urltoget)
    if (!res.ok) throw new Error(`Unexpected response while sending instruction: ${res.status}`)
    console.log("Sonos API reports: ", await res.json())

    // Wait a bit before processing next record so the API has time to respond to first command
    // e.g. want to seek on a new queue -- need the new queue to exist. Is there a way to check/confirm
    // with Sonos that a prior command is complete? I'm not sure if this a sonos thing or the http API
    // sometimes throwing commands into the ether while Sonos is busy.
    await new Promise(resolve => setTimeout(resolve, 200));
}
