/* ES5/XHR only: compatible with Safari on iOS 9. */
(function () {
  'use strict';
  var current = null, timer, minimalist = false;
  function id(name){return document.getElementById(name)}
  function message(text){id('message').innerHTML=text}
function request(method,url,body,done){if(url.charAt(0)==='/')url='https://'+location.host+url;var x=new XMLHttpRequest();var called=false;function finish(status,data){if(called)return;called=true;done(status,data)}x.open(method,url,true);if(body)x.setRequestHeader('Content-Type','application/json');x.timeout=120000;x.onreadystatechange=function(){if(x.readyState===4){var d={};try{d=JSON.parse(x.responseText||'{}')}catch(e){}if(x.status===0){setTimeout(function(){finish(0,d)},0)}else finish(x.status,d)}};x.ontimeout=function(){finish(0,{error:'Request timed out.'})};x.onerror=function(){finish(0,{error:'Could not reach the server.'})};x.send(body?JSON.stringify(body):null)}
  function showPlayer(){id('setup').className='card hidden';id('player').className='player';id('status').innerHTML='Connected';poll()}
  // Winamp mode toggle (native ES5/CSS skin; no Webamp bundle needed)
  var winampOn = false;
  var isPlayingState = false;
  function refreshBodyClass() {
    var cls = [];
    if (minimalist) cls.push('minimalist');
    if (winampOn) cls.push('winamp-active');
    if (winampOn && isPlayingState) cls.push('winamp-playing');
    document.body.className = cls.join(' ');
  }
  function setWinamp(on) {
    winampOn = on;
    id('winamp-player').className = 'winamp' + (on ? '' : ' hidden');
    id('player').className = 'player' + (on ? ' hidden' : '');
    id('winamp-toggle').innerHTML = on ? 'Exit Winamp' : 'Winamp Mode';
    id('winamp-toggle').className = on ? 'secondary small-button winamp-on' : 'secondary small-button';
    refreshBodyClass();
    if (on) render(current);
  }
  function winampCommand(action) { command(action); }
  id('winamp-toggle').addEventListener('click', function () { setWinamp(!winampOn); });
  id('winamp-exit').addEventListener('click', function () { setWinamp(false); });
  id('winamp-prev').addEventListener('click', function () { winampCommand('previous'); });
  id('winamp-next').addEventListener('click', function () { winampCommand('next'); });
  id('winamp-stop').addEventListener('click', function () { winampCommand('pause'); });
  id('winamp-play').addEventListener('click', function () { winampCommand(current && current.is_playing ? 'pause' : 'play'); });
  id('winamp-pause').addEventListener('click', function () { winampCommand('pause'); });
  function pair(){var code=id('pairing-code').value.replace(/[^a-z0-9]/ig,'').toUpperCase();if(!code){message('Enter the code shown in Safari after Spotify login.');return}message('Pairing this fullscreen app…');request('POST','/api/auth/pair',{code:code},function(status,data){if(status===200){message('');showPlayer()}else if(status===0)message('Could not reach the server. Check the connection and try again.');else message((data&&data.error)||('Pairing failed (status '+status+'). Try a new code.'))})}
  function login(){window.location.href='/api/auth/login'}
  function formatTime(ms){if(!ms||ms<0)ms=0;var totalSec=Math.floor(ms/1000),m=Math.floor(totalSec/60),s=totalSec%60;return m+':'+(s<10?'0':'')+s}
  function schedulePoll(delay){if(timer)clearTimeout(timer);timer=setTimeout(poll,delay)}
  function pollDelay(data){var item=data&&data.item;if(!item)return 30000;if(!data.is_playing)return 30000;var duration=item.duration_ms||0,progress=data.progress_ms||0,remaining=duration-progress;if(remaining>0&&remaining<=20000)return Math.max(3000,Math.min(10000,remaining-2000));return 15000}
  function updateTimeline(){if(!current||!current.item){id('timeline-fill').style.width='0%';id('time-elapsed').innerHTML='0:00';id('time-duration').innerHTML='0:00';id('winamp-fill').style.width='0%';id('winamp-elapsed').innerHTML='0:00';id('winamp-duration').innerHTML='0:00';return}var duration=current.item.duration_ms||0,elapsed=current.progress_ms||0;if(current.is_playing)elapsed+=Date.now()-current.fetched_at;if(elapsed>duration)elapsed=duration;var pct=duration?Math.min(100,elapsed/duration*100):0;id('timeline-fill').style.width=pct+'%';id('time-elapsed').innerHTML=formatTime(elapsed);id('time-duration').innerHTML=formatTime(duration);id('winamp-fill').style.width=pct+'%';id('winamp-elapsed').innerHTML=formatTime(elapsed);id('winamp-duration').innerHTML=formatTime(duration)}
  function setPlaying(isPlaying){isPlayingState=!!isPlaying;id('play').className=isPlaying?'play icon-play is-playing':'play icon-play';refreshBodyClass()}
  function setWinampTrack(text){var el=id('winamp-track');if(el)el.innerHTML=text||'Nothing playing'}
  function render(data){var item=data&&data.item;if(!item){id('title').innerHTML='Nothing playing';id('artist').innerHTML='Start Spotify on another device';id('album').innerHTML='';id('minimalist-artist').innerHTML='';id('minimalist-title').innerHTML='Nothing playing';id('art').style.display='none';id('placeholder').className='';setPlaying(false);setWinampTrack('');current=null;updateTimeline();return}current=data;current.fetched_at=Date.now();var artist=item.artists.map(function(a){return a.name}).join(', ');id('title').innerHTML=item.name;id('artist').innerHTML=artist;id('album').innerHTML=item.album.name;id('minimalist-artist').innerHTML=artist;id('minimalist-title').innerHTML=item.name;setPlaying(!!data.is_playing);setWinampTrack(escapeHtml(artist)+' — '+escapeHtml(item.name));if(item.album.images&&item.album.images.length){id('art').src=item.album.images[0].url;id('art').style.display='block';id('placeholder').className='hidden'}updateTimeline()}
  function poll(){request('GET','/api/spotify/currently-playing',null,function(status,data){if(status===200){render(data);id('winamp-message').innerHTML='Playing';schedulePoll(pollDelay(data))}else if(status===401){id('status').innerHTML='Not connected';id('player-message').innerHTML=data.error||'Pair again.';id('winamp-message').innerHTML=data.error||'Pair again.';schedulePoll(30000)}else{id('player-message').innerHTML='Waiting for Spotify…';id('winamp-message').innerHTML='Waiting for Spotify…';schedulePoll(30000)}})}
  function command(action){request('POST','/api/spotify/command',{action:action},function(status,data){if(status!==200){var m=data.error||'Command failed';id('player-message').innerHTML=m;id('winamp-message').innerHTML=m}else{id('winamp-message').innerHTML='Command sent'}schedulePoll(750)})}
  setInterval(updateTimeline,1000);
  function createBadge(){var url = '/api/badge/'+Date.now(); request('POST', url, {}, function(status,data){if(status===200){window.prompt('Copy this Markdown into your GitHub profile README:', '[![Last played on Spotify]('+data.url+')](https://'+window.location.host+'/)')}else id('player-message').innerHTML=data.error||'Could not create badge.'})}
  function escapeHtml(text){return text.replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function openArtistModal(){id('artist-modal').className='modal';switchSearchMode('artist');id('artist-query').value='';id('playlist-query').value='';id('artist-results').innerHTML='';id('artist-message').innerHTML='';id('artist-query').focus()}
  function closeArtistModal(){id('artist-modal').className='modal hidden'}
  function switchSearchMode(type){var isPlaylist=type==='playlist';id('search-tab-artist').className=isPlaylist?'search-tab':'search-tab search-tab-active';id('search-tab-playlist').className=isPlaylist?'search-tab search-tab-active':'search-tab';id('artist-query-label').className=isPlaylist?'hidden':'';id('playlist-query-label').className=isPlaylist?'':'hidden';var artistField=id('artist-query'),playlistField=id('playlist-query');artistField.className=isPlaylist?'hidden':'';playlistField.className=isPlaylist?'':'hidden';artistField.value='';playlistField.value='';id('artist-results').innerHTML='';id('artist-message').innerHTML='';(isPlaylist?playlistField:artistField).focus()}
  function searchArtist(){var mode=id('search-tab-playlist').className.indexOf('search-tab-active')!==-1?'playlist':'artist';var q=(mode==='playlist'?id('playlist-query'):id('artist-query')).value.trim();if(!q){id('artist-message').innerHTML='Enter a'+(mode==='playlist'?' playlist name':'n artist name')+'.';return}id('artist-message').innerHTML='Searching…';id('artist-results').innerHTML='';var endpoint='/api/spotify/search-'+(mode==='playlist'?'playlist':'artist')+'?q='+encodeURIComponent(q);request('GET',endpoint,null,function(status,data){var key=mode==='playlist'?'playlists':'artists';if(status!==200){id('artist-message').innerHTML=data.error||'Search failed.';return}var items=data[key]||[];if(!items.length){id('artist-message').innerHTML='No '+(mode==='playlist'?'playlists':'artists')+' found.';return}id('artist-message').innerHTML='';var html='';for(var i=0;i<items.length;i++){html+='<button type="button" class="artist-result" data-id="'+items[i].id+'">'+escapeHtml(items[i].name)+'</button>'}id('artist-results').innerHTML=html;var buttons=id('artist-results').getElementsByTagName('button');for(var j=0;j<buttons.length;j++){buttons[j].onclick=function(){playTarget(mode,this.getAttribute('data-id'),this.innerHTML)}}})}
  function playTarget(mode,itemId,name){var noun=mode==='playlist'?'playlist':'artist radio';id('artist-message').innerHTML='Starting '+name+' ('+noun+')…';var body={action:mode==='playlist'?'play_playlist':'play_artist'};body[mode==='playlist'?'playlist_id':'artist_id']=itemId;request('POST','/api/spotify/command',body,function(status,data){if(status!==200){id('artist-message').innerHTML=data.error||'Could not start '+noun+'.';schedulePoll(750);return}closeArtistModal();schedulePoll(750)})}
  function enterMinimalist(){minimalist=true;id('minimalist').innerHTML='Regular View';refreshBodyClass()}
  function exitMinimalist(){minimalist=false;id('exit-modal').className='modal hidden';id('minimalist').innerHTML='Minimalist View';refreshBodyClass()}
  id('login').onclick=login;id('pair').onclick=pair;id('pairing-code').onkeyup=function(e){if(e&&e.keyCode===13)pair()};id('previous').onclick=function(){command('previous')};id('next').onclick=function(){command('next')};id('play').onclick=function(){command(current&&current.is_playing?'pause':'play')};id('minimalist').onclick=function(){if(minimalist)exitMinimalist();else enterMinimalist()};id('badge').onclick=createBadge;id('art-tap').onclick=function(){if(minimalist)id('exit-modal').className='modal';};id('exit-yes').onclick=exitMinimalist;id('exit-no').onclick=function(){id('exit-modal').className='modal hidden'};id('disconnect').onclick=function(){request('POST','/api/auth/logout',null,function(){location.reload()})};id('search-artist').onclick=openArtistModal;id('search-tab-artist').onclick=function(){switchSearchMode('artist')};id('search-tab-playlist').onclick=function(){switchSearchMode('playlist')};id('artist-search-go').onclick=searchArtist;id('artist-cancel').onclick=closeArtistModal;id('artist-query').onkeyup=function(e){if(e&&e.keyCode===13)searchArtist()};id('playlist-query').onkeyup=function(e){if(e&&e.keyCode===13)searchArtist()};
  request('GET','/api/spotify/currently-playing',null,function(status){if(status===200)showPlayer()});
}());
