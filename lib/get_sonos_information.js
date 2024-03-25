import fetch from 'node-fetch'
import fs from 'fs'

var {sonos_room,sonos_room_backup, sonos_http_api} = JSON.parse(fs.readFileSync('usersettings.json', 'utf-8'))

export async function get_sonos_information(received_text) {
    let sonos_instruction
    sonos_instruction = received_text.toLowerCase()

    let urltoget
    urltoget = sonos_http_api + "/" + sonos_instruction
    
    // Perform the requested action on the sonos API
    console.log("Fetching URL via HTTP api: %s", urltoget)
    const res = await fetch(urltoget)
    if (!res.ok) throw new Error(`Unexpected response while sending instruction: ${res.status}`)
    //console.log("Sonos API reports: ", await res.json())
    const response = res.json()
    return response

    // Wait a bit before processing next record so the API has time to respond to first command
    // e.g. want to seek on a new queue -- need the new queue to exist. Is there a way to check/confirm
    // with Sonos that a prior command is complete? I'm not sure if this a sonos thing or the http API
    // sometimes throwing commands into the ether while Sonos is busy.
    //await new Promise(resolve => setTimeout(resolve, 200));    
}

export async function get_sonos_room_information(received_text) {
    let sonos_instruction
    sonos_instruction = received_text.toLowerCase()

    let room
    room = await get_available_sonos_room()

    let urltoget
    urltoget = sonos_http_api + "/" + room + "/" + sonos_instruction
    
    // Perform the requested action on the sonos API
    console.log("Fetching URL via HTTP api: %s", urltoget)
    const res = await fetch(urltoget)
    if (!res.ok) throw new Error(`Unexpected response while sending instruction: ${res.status}`)
    //console.log("Sonos API reports: ", await res.json())
    const response = res.json()
    return response

    // Wait a bit before processing next record so the API has time to respond to first command
    // e.g. want to seek on a new queue -- need the new queue to exist. Is there a way to check/confirm
    // with Sonos that a prior command is complete? I'm not sure if this a sonos thing or the http API
    // sometimes throwing commands into the ether while Sonos is busy.
    //await new Promise(resolve => setTimeout(resolve, 200));    
}

export async function get_available_sonos_room_old() {
    let zones = await get_sonos_information("zones")
    let i
    for (i=0;i<Object.keys(zones).length;i++){
      if (zones[i]['coordinator']['roomName'] == sonos_room){
          return sonos_room
      }
    }
    for (i=0;i<Object.keys(zones).length;i++){
      if (zones[i]['coordinator']['roomName'] == sonos_room_backup){
          return sonos_room_backup
      }
    }
    console.log('no room available - abort (restart will be tried by PM2)')
    return process.abort()
}

export async function get_available_sonos_room() {

    let urltoget

    //base url for checking if SONOS API is available
    urltoget = sonos_http_api

    for (let i=0; i<=20; i++ ) {
        try{
            console.log("Try number " + i + " to check if SONOS API is up already: %s", urltoget)
            await fetch(urltoget)
            console.log('SONOS API available after ' + i + ' tries')
            //sleep shortly since sometimes rooms need a little to be loaded
            await Sleep(1000)
            break
        }catch (err) {
            if (i==20){
                console.error('SONOS API not available after 20 retries - abort (restart will be tried by PM2)')
                return process.abort()
            }
            console.log('SONOS API not available - try again after 1s')
            await Sleep(1000)	
        }
    }

    urltoget = sonos_http_api + "/" + sonos_room + "/state"
    console.log("Try to connect main room : " + sonos_room)
    console.log("Fetching URL via HTTP api: %s", urltoget)
    const res = await fetch(urltoget)
    if (res.ok) return sonos_room

    urltoget = sonos_http_api + "/" + sonos_room_backup + "/state"
    console.log("Try to connect backup room : " + sonos_room_backup)
    console.log("Fetching URL via HTTP api: %s", urltoget)
    const res1 = await fetch(urltoget)
    if (res1.ok) return sonos_room_backup

    console.log('no room available - abort (restart will be tried by PM2)')
    return process.abort()
}