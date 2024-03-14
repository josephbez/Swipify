import React, { useRef, useState, useEffect } from 'react';
import './WebPlayback.css';
import { pre_webplayer, transferPlayback, play_playlist } from './pre_webplayer.js';



/**
 * 
 * @function WebPlayback
 * @functiondesc This component is responsible for the playback of 
 * the playlist in the browser. It uses the Spotify Web Playback SDK 
 * to play the playlist in the browser. 
 */
export default function WebPlayback(props) {
    const isMounted = useRef(true); // Ref to keep track of component mount state
    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [player, setPlayer] = useState(undefined);
    const [current_track, setTrack] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [gotTracks, setGotTracks] = useState(false);
    const [tracksToRemove, setTracksToRemove] = useState([]);
    const [deletionStatus, setDeletionStatus] = useState("");
    const [counter, setCounter] = useState(0);
    const num_tracks = props.track_list.length;
    useEffect(() => {
        // Initialize Spotify player here
        pre_webplayer(props, player, setPlayer, setTrack, setActive, setDeviceId, setPaused);

    }, []);

    useEffect(() => {
        // Function to pause the Spotify player
        console.log("player", player);
        const pausePlayer = () => {
            if (player) {
                player.pause()
                console.log('Playback paused');
            }
        };

        // Add event listener for beforeunload event
        window.addEventListener('beforeunload', pausePlayer);

        // Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('beforeunload', pausePlayer);
            if (player) {
                player.pause();
            }
        };
    }, [player]);

    useEffect(() => {
        transferPlayback(props, deviceId);
    }, [deviceId])
    useEffect(() => {
        play_playlist(props, setGotTracks, setTrack, deviceId);
    }, [deviceId, props.token]);

    const handleClick = (action) => {
        if (!player) return;
        switch (action) {
            case 'remove':
                let updatedTrackToRemove = [...tracksToRemove];
                if (tracksToRemove[tracksToRemove.length - 1]?.id == current_track.id) {
                    break;
                }
                updatedTrackToRemove.push(current_track);
                setTracksToRemove(updatedTrackToRemove);
            case 'keep':
                player.nextTrack();
                setCounter(counter + 1);
                setTrack(props.track_list[(counter + 1) % num_tracks]);
                break;
            case 'undo':
                player.previousTrack();
                // implement functional undo button stuff
                {
                    player.previousTrack();
                    let updatedTrackToRemove = [...tracksToRemove];
                    let recentlyRemoved = updatedTrackToRemove.pop();

                    if (counter >= 0 && props.track_list[(counter - 1) % num_tracks].id == recentlyRemoved?.id) {
                        setTracksToRemove(updatedTrackToRemove);
                    }

                    setCounter(counter - 1);
                }
                break;
            case 'toggle':
                is_paused ? player.resume() : player.pause();
                setPaused(!is_paused);
                break;
        }
    };


    const confirmDelete = async () => {
        // DELETED 

        setDeletionStatus("Deleting...");

        let ids_to_remove = tracksToRemove.map((track) => track.id);
        const response = await fetch('http://localhost:8000/remove_tracks?' + new URLSearchParams({
            playlist_id: props.playlist_id,
            track_ids: ids_to_remove
        }), { method: 'DELETE' });

        setTracksToRemove([]);
        setDeletionStatus("Changes confirmed.");
    }

    useEffect(() => {
        // Define handleKeyPress inside useEffect or after handleClick if handleClick is outside useEffect
        const handleKeyPress = (event) => {
            switch (event.key) {
                case 'ArrowRight':
                    handleClick('keep');
                    break;
                case 'ArrowLeft':
                    handleClick('undo');
                    break;
                case 'Backspace':
                    handleClick('remove');
                    break;
                case ' ':
                    event.preventDefault();
                    handleClick('toggle');
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [current_track, handleClick]); // handleClick dependency is now valid

    console.log("is_active", is_active);
    console.log("gotTracks", gotTracks);
    console.log("current_track", current_track);

    if (!is_active || !gotTracks || !current_track) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <>
            <div className='sidebar'>
                <div className='deleted-tracks-list'>
                    <h2>Deleted Tracks</h2>
                    {tracksToRemove.map((item, index) => (
                        <div key={index} className="deleted-track">
                            <div className="track-container">
                                {/* <button className="remove-track-btn"> 
                                x
                            </button> */}
                                <span>{item.name} - {item.artists[0].name}</span>
                            </div>
                        </div>
                    ))}
                    {tracksToRemove.length > 0 && (
                        <button className='confirm-btn' onClick={confirmDelete}>Confirm</button>
                    )}
                </div>
                <div>
                    {deletionStatus}
                </div>
            </div>
            <select>
                {props.track_list.map((item) => <option key={item.id}>{item.name}</option>)}
            </select>
            <div className="container">
                <div className="main-wrapper">
                    <div className="playlist-name">{props.playlist_name}</div>
                    <img src={current_track?.album?.images[0]?.url} className="album-img" alt="" />
                    <div className="now-playing">
                        <div className="now-playing__name">{current_track?.name}</div>
                        <div className="now-playing__artist">{current_track?.artists[0]?.name}</div>
                        <button className="spotify-btn" onClick={() => handleClick('remove')}>
                            <i className="fas fa-trash"></i>
                        </button>
                        <button className='spotify-btn' onClick={() => handleClick('undo')}>
                            <i className="fas fa-undo"></i>
                        </button>
                        <button className="spotify-btn" onClick={() => handleClick('toggle')}>
                            {is_paused ? <i className="fas fa-play"></i> : <i className="fas fa-pause"></i>}
                        </button>
                        <button className="spotify-btn" onClick={() => handleClick('keep')}>
                            <i className="fas fa-arrow-right"></i>
                        </button>
                        <ProgressBar current={counter} total={num_tracks} />

                    </div>
                </div>
            </div>
        </>
    );
};


const ProgressBar = (props) => {
    let { current, total } = props;
    current > total ? current = total : null;
    let percent = (current) / total * 100;
    percent = percent.toFixed(2); // Rounds to 2 decimal places


    const containerStyles = {
        border: 'solid',
        height: 20,
        width: '100%',
        backgroundColor: "#212121",
        margin: '50px 0px',
        borderRadius: 20,
        borderColor: '#f0f8ff',
    }

    const fillerStyles = {
        height: '100%',
        width: `${percent}%`,
        backgroundColor: '#f0f8ff',
        textAlign: 'right',
        borderRadius: 'inherit'
    }

    const labelStyles = {
        padding: 5,
        color: '#212121',
        fontWeight: 'bold'
    }

    const noAlign = {
        textAlign: 'left',
        width: '100%',
        margin: 5
    }

    return (
        <div style={containerStyles}>
            <div style={fillerStyles}>
                <span style={labelStyles}>{`${percent}%`}</span>
            </div>
            <div style={noAlign} className='deleted-tracks-list'>Progress: {current} / {total}</div>
        </div>
    );
};

