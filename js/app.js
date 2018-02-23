"use strict";

mapboxgl.accessToken = '';

// Deploy your own services using https://github.com/RemotePixel/remotepixel-api
const sentinel_services = '';
const landsat_services = '';
const cbers_services = '';

var scope = {};

////////////////////////////////////////////////////////////////////////////////
//From Libra by developmentseed (https://github.com/developmentseed/libra)
const zeroPad = (n, c) => {
  let s = String(n);
  if (s.length < c) s = zeroPad('0' + n, c);
  return s;
}

const sortScenes = (a, b) => {
  return moment(b.date, 'YYYY-MM-DD') - moment(a.date, 'YYYY-MM-DD');
};

const parse_s2_tile = (tile) => {
  return {
    uz: tile.slice(0, 2),
    lb: tile.slice(2, 3),
    sq: tile.slice(3, 5)
  };
};

const s2_name_to_key = (scene) => {
  const info = scene.split('_');
  const acquisitionDate = info[2];
  const tile_info = parse_s2_tile(info[3]);

  return [
    tile_info.uz.replace(/^0/, ''),
    tile_info.lb,
    tile_info.sq,
    acquisitionDate.slice(0,4),
    acquisitionDate.slice(4,6).replace(/^0+/, ''),
    acquisitionDate.slice(6,8).replace(/^0+/, ''),
    info[4]
  ].join('/');
};


////////////////////////////////////////////////////////////////////////////////
const buildQueryAndRequestL8 = (features) => {
  $('.list-img').scrollTop(0);
  $('.list-img').empty();
  $(".metaloader").removeClass('off');

  scope.results = {};

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3);
    const path = zeroPad(e.properties.PATH, 3);
    const query = `${landsat_services}/search?row=${row}&path=${path}&full=true`;

    const grid = `${path}/${row}`;
    scope.results[grid] = [];

    return $.getJSON(query).done()
      .then(data => {
        if (data.errorMessage) throw new Error('API Error');
        if (data.meta.found === 0) throw new Error('No image found');
        return data.results;
      })
      .catch(err => {
        console.warn(err);
        return [];
      });
  }))
    .then(res => {
      const all = [].concat.apply([], res);
      if (all.length === 0) throw new Error('No image found');
      for (let i = 0; i < res.length; i += 1) {
        let data = res[i];
        let scenes = {};
        for (let i = 0; i < data.length; i += 1) {
            let scene = {};
            scene.path = data[i].path;
            scene.row = data[i].row;
            scene.date = moment(data[i].acquisition_date, "YYYYMMDD").format('YYYY-MM-DD');
            scene.grid = `${scene.path}/${scene.row}`;
            scene.cloud = data[i].cloud_coverage;
            scene.browseURL = data[i].browseURL;
            scene.thumbURL = data[i].thumbURL;
            scene.scene_id = data[i].scene_id;
            scene.type = data[i].category;
            scene.key = data[i].key;
            scene.AWSurl = `https://landsatonaws.com/L8/${scene.path}/${scene.row}/${scene.scene_id}`;
            scenes[scene.scene_id] = scene;
        }

        let ids = Object.keys(scenes);
        for (let i = 0; i < ids.length; i += 1) {
          if (/^L[COTEM]08_.+RT$/.exec(ids[i])) {
            let id = ids[i].split('_').slice(0,4).join('_');
            let pattern = new RegExp(`^${id}`);
            let same = ids.filter(e => {return pattern.test(e);});
            if (same.length > 1) delete scenes[ids[i]];
          }
        }

        let grid_scenes = [];
        for (let key in scenes) {
            grid_scenes.push(scenes[key]);
        }
        grid_scenes.sort(sortScenes);
        scope.results[grid_scenes[0].grid] = grid_scenes;
      }

      const grid = Object.keys(scope.results);
      return grid.map(e => {
        let latest = scope.results[e][0];
        return  `<div data-grid=${latest.grid} data-path=${latest.path} data-row=${latest.row} sat="landsat8" img-date="${latest.date}" class="list-element" onclick="previewL8(this)" onmouseover="overImageL8(this)">` +
          '<div class="col">' +
            `<div class="prinfo"><span class="pathrow txt-bold">${latest.grid}</span></div>` +
            '<div class="prinfo">' +
              `<span class="date">Latest: ${latest.date} </span>` +
              `<span class="date"><i class="fa fa-cloud"></i> ${latest.cloud}%</span>` +
            '</div>' +
          '</div>' +
          '<div class="img-thumb">' +
            `<img class="img-responsive lazyload img-grid" data-srcset="${latest.browseURL}">` +
          '</div>' +
        '</div>';
      })
    })
    .catch(err => {
      console.warn(err);
      $('.list-img').append('<span class="nodata-error middle-center txt-l">No image found</span>');
    })
    .then(data => {
      $('.list-img').append(data);
      $(".metaloader").addClass('off');
    });
};

const buildQueryAndRequestS2 = (features) => {
  $('.list-img').scrollTop(0);
  $('.list-img').empty();
  $(".metaloader").removeClass('off');

  scope.results = {};

  Promise.all(features.map(e => {

    scope.results[e.properties.Name] = [];

    const utm = e.properties.Name.slice(0, 2);
    const lat = e.properties.Name.slice(2, 3);
    const grid = e.properties.Name.slice(3, 5);

    const level = 'l1c';
    const query = `${sentinel_services}/search?utm=${utm}&grid=${grid}&lat=${lat}&full=true&level=${level}`;

    return $.getJSON(query).done()
      .then(data => {
        if (data.errorMessage) throw new Error('API Error');
        if (data.meta.found === 0) throw new Error('No image found');
        return data.results;
      })
      .catch(err => {
        console.warn(err);
        return [];
      });
  }))
    .then(res => {
      const all = [].concat.apply([], res);
      if (all.length === 0) throw new Error('No image found');
      for (let i = 0; i < res.length; i += 1) {
        let data = res[i];
        for (let i = 0; i < data.length; i += 1) {
          let scene = {};
          scene.date = moment(data[i].acquisition_date, "YYYYMMDD").format('YYYY-MM-DD');
          scene.cloud = data[i].cloud_coverage;
          scene.coverage = data[i].coverage;
          scene.browseURL = data[i].browseURL;
          scene.scene_id = data[i].scene_id;
          scene.grid = data[i].scene_id.split('_')[3];
          scene.sat = scene.scene_id.slice(1,3);
          scene.path = data[i].path;
          scene.AWSurl = `http://sentinel-s2-l1c.s3-website.eu-central-1.amazonaws.com/${scene.path.replace('tiles', '#tiles')}`;
          if (scene.coverage >= 5.0) scope.results[scene.grid].push(scene);
        }
      }

      const grid = Object.keys(scope.results);
      return grid.map(e => {
        scope.results[e].sort(sortScenes);
        let latest = scope.results[e][0];
        return  `<div data-grid=${latest.grid} sat="sentinel2" img-date="${latest.date}" class="list-element" onclick="previewS2(this)" onmouseover="overImageS2(this)">` +
          '<div class="col">' +
            `<div class="prinfo"><span class="pathrow txt-bold">${latest.grid}</span></div>` +
            '<div class="prinfo">' +
              `<span class="date">Latest: ${latest.date} </span>` +
              `<span class="date"><i class="fa fa-cloud"></i> ${latest.cloud}%</span>` +
            '</div>' +
          '</div>' +
          '<div class="img-thumb">' +
            `<img class="img-responsive lazyload img-grid" data-srcset="${latest.browseURL}">` +
          '</div>' +
        '</div>';
      });
    })
    .catch(err => {
      console.warn(err);
      $('.list-img').append('<span class="nodata-error middle-center txt-l">No image found</span>');
    })
    .then(data => {
      $('.list-img').append(data);
      $(".metaloader").addClass('off');
    });
};


const buildQueryAndRequestCBERS = (features) => {
  $('.list-img').scrollTop(0);
  $('.list-img').empty();
  $(".metaloader").removeClass('off');

  scope.results = {};

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3);
    const path = zeroPad(e.properties.PATH, 3);
    const query = `${cbers_services}/search?row=${row}&path=${path}`;

    const grid = `${path}/${row}`;
    scope.results[grid] = [];

    return $.getJSON(query).done()
      .then(data => {
        if (data.errorMessage) throw new Error('API Error');
        if (data.meta.found === 0) throw new Error('No image found');
        return data.results;
      })
      .catch(err => {
        console.warn(err);
        return [];
      });
  }))
    .then(res => {
      const all = [].concat.apply([], res);
      if (all.length === 0) throw new Error('No image found');
      for (let i = 0; i < res.length; i += 1) {
        let data = res[i];
        for (let i = 0; i < data.length; i += 1) {
          let scene = {};
          scene.path = data[i].path;
          scene.row = data[i].row;
          scene.grid = `${scene.path}/${scene.row}`;
          scene.date = moment(data[i].acquisition_date, "YYYYMMDD").format('YYYY-MM-DD');
          scene.thumbURL = data[i].thumbURL;
          scene.browseURL = data[i].browseURL;
          scene.scene_id = data[i].scene_id;
          scene.type = data[i].processing_level;
          scene.key = data[i].key;
          // scene.AWSurl = `https://cbers-pds.s3.amazonaws.com/index.html`;
          scope.results[scene.grid].push(scene);
        }
      }

      const grid = Object.keys(scope.results);
      return grid.map(e => {
        scope.results[e].sort(sortScenes);
        let latest = scope.results[e][0];
        return  `<div data-grid=${latest.grid} data-path=${latest.path} data-row=${latest.row} sat="cbers4" img-date="${latest.date}" class="list-element" onclick="previewCBERS(this)" onmouseover="overImageCBERS(this)">` +
          '<div class="col">' +
            `<div class="prinfo"><span class="pathrow txt-bold">${latest.grid}</span></div>` +
            '<div class="prinfo">' +
              `<span class="date">Latest: ${latest.date} </span>` +
            '</div>' +
          '</div>' +
          '<div class="img-thumb">' +
            `<img class="img-responsive lazyload img-grid" data-srcset="${latest.browseURL}">` +
          '</div>' +
        '</div>';
      });
    })
    .catch(err => {
      console.warn(err);
      $('.list-img').append('<span class="nodata-error middle-center txt-l">No image found</span>');
    })
    .then(data => {
      $('.list-img').append(data);
      $(".metaloader").addClass('off');
    });
};


const previewL8 = (e) => {
  const grid = e.getAttribute('data-grid');
  const res = scope.results[grid];

  for (let i = 0; i < res.length; i += 1) {
    $('#scenes-preview').append(
      `<div id='scene-preview' data-grid=${res[i].grid} data-scene=${res[i].scene_id} class="col col--4-mm col--3-ml col--6 relative img-thumb cursor-pointer" onclick="download(this)">` +
        `<img class="img-responsive lazyload img-preview" data-srcset="${res[i].browseURL}" class="img-responsive">` +
        '<div class="result-overlay absolute top left w-full px12 py12 txt-s-mm txt-xs color-white">' +
          `<span>Landsat-8 (${res[i].type})</span>` +
          `<span><i class="fa fa-calendar-o"></i> ${res[i].date}</span>` +
          `<span><i class="fa fa-cloud"></i> ${res[i].cloud}%</span>` +
          `<a target="_blank" href="https://viewer.remotepixel.ca/?sceneid=${res[i].scene_id}"><img src="/img/rpix.png"></a>` +
          `<a target="_blank" href="${res[i].AWSurl}"><img src="/img/aws.png"></a>` +
        '</div>' +
      '</div>');
  }
  $('#gridname').text(`Grid: ${grid}`);
  $('#nbimg').text(`Nb scenes: ${res.length}`);
  $('#preview').addClass('in');
};


const previewS2 = (e) => {
  const grid = e.getAttribute('data-grid');
  const res = scope.results[grid];

  for (let i = 0; i < res.length; i += 1) {
    $('#scenes-preview').append(
      `<div id='scene-preview' data-grid=${res[i].grid} data-scene=${res[i].scene_id} class="col col--4-mm col--3-ml col--6 relative img-thumb bg-gray-light-on-hover cursor-pointer" onclick="download(this)">` +
        `<img class="img-responsive lazyload img-preview" data-srcset="${res[i].browseURL}" class="img-responsive">` +
        '<div class="result-overlay absolute top left w-full px12 py12 txt-s-mm txt-xs color-white">' +
          `<span>Sentinel-${res[i].sat}</span>` +
          `<span><i class="fa fa-calendar-o"></i> ${res[i].date}</span>` +
          `<span><i class="fa fa-cloud"></i> ${res[i].cloud}%</span>` +
          `<span><i class="fa fa-map-o"></i> ${res[i].coverage}'%</span>` +
          `<a target="_blank" href="https://viewer.remotepixel.ca/?sceneid=${res[i].scene_id}"><img src="/img/rpix.png"></a>` +
          `<a target="_blank" href="${res[i].AWSurl}"><img src="/img/aws.png"></a>` +
        '</div>' +
      '</div>');
  }
  $('#gridname').text(`Grid: ${grid}`);
  $('#nbimg').text(`Nb scenes: ${res.length}`);
  $('#preview').addClass('in');
};


const previewCBERS = (e) => {
  const grid = e.getAttribute('data-grid');
  const res = scope.results[grid];

  for (let i = 0; i < res.length; i += 1) {
    $('#scenes-preview').append(
      `<div id='scene-preview' data-grid=${res[i].grid} data-scene=${res[i].scene_id} class="col col--4-mm col--3-ml col--6 relative img-thumb bg-gray-light-on-hover cursor-pointer" onclick="download(this)">` +
        `<img class="img-responsive lazyload img-preview" data-srcset="${res[i].browseURL}" class="img-responsive">` +
        '<div class="result-overlay absolute top left w-full px12 py12 txt-s-mm txt-xs color-white">' +
          `<span>CBERS-4</span>` +
          `<span><i class="fa fa-calendar-o"></i> ${res[i].date}</span>` +
          `<a target="_blank" href="https://viewer.remotepixel.ca/?sceneid=${res[i].scene_id}"><img src="/img/rpix.png"></a>` +
          // `<a target="_blank" href="${res[i].AWSurl}"><img src="/img/aws.png"></a>` +
        '</div>' +
      '</div>');
  }
  $('#gridname').text(`Grid: ${grid}`);
  $('#nbimg').text(`Nb scenes: ${res.length}`);
  $('#preview').addClass('in');
};

const download = (e) => {

  $('#download').addClass('in');

  const grid = e.getAttribute('data-grid');
  const scene_id = e.getAttribute('data-scene');

  document.getElementById('download').setAttribute('data-scene', scene_id);

  $(`#scenes-preview [data-scene=${scene_id}]`).addClass('active');
  $(`#scenes-preview [data-scene!=${scene_id}]`).removeClass('active');

  const scene_info = scope.results[grid].filter(e => {
    return (e.scene_id === scene_id);
  })[0];

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  switch(sat) {
    case 'landsat':
      updateLandsatUI(scene_info);
      break;
    case 'sentinel':
      updateSentinelUI(scene_info);
      break;
    case 'cbers':
      updateCbersUI(scene_info);
      break;
    default:
      throw new Error(`Invalid ${sat}`);
  }
};

const updateLandsatUI = (info) => {
  const aws_url = `https://landsat-pds.s3.amazonaws.com/${info.key}`;
  $('#band ul').empty();
  $('#band ul').append(`<li class="txt-xs">${info.scene_id}</li>`);
  $('#band ul').append(`<li><a  id="b1" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B1.TIF" download>B1 - Coastal aerosol</a></li>`);
  $('#band ul').append(`<li><a  id="b2" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B2.TIF" download>B2 - Blue</a></li>`);
  $('#band ul').append(`<li><a  id="b3" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B3.TIF" download>B3 - Green</a></li>`);
  $('#band ul').append(`<li><a  id="b4" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B4.TIF" download>B4 - Red</a></li>`);
  $('#band ul').append(`<li><a  id="b5" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B5.TIF" download>B5 - Near Infrared</a></li>`);
  $('#band ul').append(`<li><a  id="b6" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B6.TIF" download>B6 - Shortwave Infrared 1</a></li>`);
  $('#band ul').append(`<li><a  id="b7" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B7.TIF" download>B7 - Shortwave Infrared 2</a></li>`);
  $('#band ul').append(`<li><a  id="b8" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B8.TIF" download>B8 - Panchromatic (15m)</a></li>`);
  $('#band ul').append(`<li><a  id="b9" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B9.TIF" download>B9 - Cirrus</a></li>`);
  $('#band ul').append(`<li><a id="b10" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B10.TIF" download>B10 - Thermal Infrared 1</a></li>`);
  $('#band ul').append(`<li><a id="b11" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_B11.TIF" download>B11 - Thermal Infrared 2</a></li>`);
  $('#band ul').append(`<li><a id="bQA" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_BQA.TIF" download>BQA - Quality Assessment</a></li>`);
  $('#band ul').append(`<li><a id="mtl" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}_MTL.txt" download>MTL - Metadata</a></li>`);

  $("#btn-dwn").html('Download').prop('disabled', false).removeClass('none').removeClass('btn--red');
  $("#btn-dwn-ready").addClass('none').attr('href','');
  if ($('#toolbar .active')[0].id !== 'band') updatePreview();
};

const updateSentinelUI = (info) => {
  const aws_url = `https://sentinel-s2-l1c.s3.amazonaws.com/${info.path}`;

  $('#band ul').empty();
  $('#band ul').append(`<li class="txt-xs">${info.scene_id}</li>`);
  $('#band ul').append(`<li><a  id="b1" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B01.jp2" download>B01 - Coastal (60m)</a></li>`);
  $('#band ul').append(`<li><a  id="b2" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B02.jp2" download>B02 - Blue (10m)</a></li>`);
  $('#band ul').append(`<li><a  id="b3" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B03.jp2" download>B03 - Green (10m)</a></li>`);
  $('#band ul').append(`<li><a  id="b4" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B04.jp2" download>B04 - Red (10m)</a></li>`);
  $('#band ul').append(`<li><a  id="b5" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B05.jp2" download>B05 - Vegetation Classif 1 (20m)</a></li>`);
  $('#band ul').append(`<li><a  id="b6" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B06.jp2" download>B06 - Vegetation Classif 2 (20m)</a></li>`);
  $('#band ul').append(`<li><a  id="b7" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B07.jp2" download>B07 - Vegetation Classif 3 (20m)</a></li>`);
  $('#band ul').append(`<li><a  id="b8" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B08.jp2" download>B08 - Near Infrared (10m)</a></li>`);
  $('#band ul').append(`<li><a id="b8a" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B8A.jp2" download>B8A - Narrow Near Infrared (20m)</a></li>`);
  $('#band ul').append(`<li><a  id="b9" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B09.jp2" download>B09 - Water vapour (60m)</a></li>`);
  $('#band ul').append(`<li><a id="b10" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B10.jp2" download>B10 - Cirrus (60m)</a></li>`);
  $('#band ul').append(`<li><a id="b11" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B11.jp2" download>B11 - Shortwave Infrared 1 (20m)</a></li>`);
  $('#band ul').append(`<li><a id="b12" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}B12.jp2" download>B12 - Shortwave Infrared 2 (20m)</a></li>`);
  $('#band ul').append(`<li><a id="met" class="color-red-on-hover txt-xs txt-m-mm" target="_blank" href="${aws_url}productInfo.json" download>Metadata</a></li>`);

  if ($('#toolbar .active')[0].id !== 'band') updatePreview();
};

const updateCbersUI = (info) => {
  $("#btn-dwn").html('Download').prop('disabled', false).removeClass('none').removeClass('btn--red');
  $("#btn-dwn-ready").addClass('none').attr('href','');
  if ($('#toolbar .active')[0].id !== 'band') updatePreview();
};

// Download UI
const landsatUI = () => {
  switchPane({id:'band'});
  $("#download-button").removeClass('none');

  $(`#toolbar #band`).removeClass('disabled-click');
  $('#toolbar #band ul').empty();

  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="4,3,2">Natural Color (4,3,2)</option>' +
    '<option value="7,6,4">False Color Urban (7,6,4)</option>' +
    '<option value="5,4,3">Color Infrared Vegetation (5,4,3)</option>' +
    '<option value="6,5,2">Agriculture (6,5,2)</option>' +
    '<option value="7,6,5">Atmospheric Penetration (7,6,5)</option>' +
    '<option value="5,6,2">Healthy Vegetation (5,6,2)</option>' +
    '<option value="7,5,2">Forest Burn (7,5,2)</option>' +
    '<option value="5,6,4">Land/Water (5,6,4)</option>' +
    '<option value="7,5,3">Natural With Atmo Removal (7,5,3)</option>' +
    '<option value="7,5,4">Shortwave Infrared (7,5,4)</option>' +
    '<option value="5,7,1">False color 2 (5,7,1)</option>' +
    '<option value="6,5,4">Vegetation Analysis (6,5,4)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="1">01</option>' +
      '<option value="2">02</option>' +
      '<option value="3">03</option>' +
      '<option value="4">04</option>' +
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="9">09</option>' +
      '<option value="10">10</option>' +
      '<option value="11">11</option>');
  });
  $('#r option[value="4"]').attr('selected', 'selected');
  $('#g option[value="3"]').attr('selected', 'selected');
  $('#b option[value="2"]').attr('selected', 'selected');

  $('#ratio-selection').empty();
  $('#ratio-selection').append(
    '<option value="(b5-b4)/(b5+b4)" name="ndvi">NDVI</option>' +
    '<option value="(b2-b5)/(b2+b5)" name="ndsi">NDSI</option>' +
    '<option value="(b5-b6)/(b5+b6)" name="ndwi">NDWI</option>' +
    '<option value="(b1-b2)/(b1+b2)" name="ac-index">AC-Index</option>');
};


const sentinelUI = () => {
  switchPane({id:'band'});
  $("#download-button").addClass('none');

  $(`#toolbar #band`).removeClass('disabled-click');
  $('#toolbar #band ul').empty();

  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="04,03,02">Natural Color (04,03,02)</option>' +
    '<option value="11,8A,04">Vegetation Analysis (11,8A,04)</option>' +
    '<option value="12,11,04">False Color Urban (12,11,04)</option>' +
    '<option value="08,04,03">Color Infrared Vegetation (08,04,03)</option>' +
    '<option value="12,11,8A">Atmospheric Penetration (12,11,8A)</option>' +
    '<option value="8A,11,02">Healthy Vegetation (8A,11,02)</option>' +
    '<option value="11,8A,02">Agriculture (11,8A,02)</option>' +
    '<option value="8A,11,04">Land/Water (8A,11,04)</option>' +
    '<option value="12,8A,04">Shortwave Infrared (7,5,4)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="01">01</option>' +
      '<option value="02">02</option>' +
      '<option value="03">03</option>' +
      '<option value="04">04</option>' +
      '<option value="05">05</option>' +
      '<option value="06">06</option>' +
      '<option value="07">07</option>' +
      '<option value="08">08</option>' +
      '<option value="8A">8A</option>' +
      '<option value="09">09</option>' +
      '<option value="10">10</option>' +
      '<option value="11">11</option>' +
      '<option value="12">12</option>')
  });
  $('#r option[value="04"]').attr('selected', 'selected');
  $('#g option[value="03"]').attr('selected', 'selected');
  $('#b option[value="02"]').attr('selected', 'selected');

    $('#ratio-selection').empty();
    $('#ratio-selection').append(
      '<option value="(b08-b04)/(b08+b04)" name="ndvi">NDVI</option>' +
      '<option value="(b02-b08)/(b02+b08)" name="ndsi">NDSI</option>');
};

const cbersUI = () => {
  $(`#toolbar #band`).addClass('disabled-click');
  switchPane({id:'rgb'});
  $("#download-button").removeClass('none');

  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="7,6,5">Natural Color (7,6,5)</option>' +
    '<option value="8,7,6">Color Infrared Vegetation (8,7,6)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="8">08</option>');
  });

  $('#r option[value="7"]').attr('selected', 'selected');
  $('#g option[value="6"]').attr('selected', 'selected');
  $('#b option[value="5"]').attr('selected', 'selected');

  $('#ratio-selection').empty();
  $('#ratio-selection').append('<option value="(b8-b7)/(b8+b7)" name="ndvi">NDVI</option>');
};

const updatePreview = () => {
  if (!$('#download').hasClass('in')) return;

  $("#btn-dwn").html('Download').prop('disabled', false).removeClass('none').removeClass('btn--red');
  $("#btn-dwn-ready").addClass('none').attr('href','');

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');

  let url;
  switch(sat) {
    case 'landsat':
      url = `${landsat_services}/overview`;
      break;
    case 'sentinel':
      url = `${sentinel_services}/overview`;
      break;
    case 'cbers':
      url = `${cbers_services}/overview`;
      break;
    default:
      throw new Error(`Invalid ${sat}`);
  }

  let scene = $('#scenes-preview .active')[0].getAttribute('data-scene');
  let params = {
    'scene': scene,
    'format': 'jpeg'};

  // RGB
  if ($('#rgb').hasClass('active')) {
    const r = document.getElementById('r').value;
    const g = document.getElementById('g').value;
    const b = document.getElementById('b').value;
    params.bands = [r, g, b].join(',');
  } else if ($('#process').hasClass('active')) {
    params.expression = encodeURIComponent(document.getElementById('ratio-selection').value);
  }

  const url_params = Object.keys(params).map(i => `${i}=${params[i]}`).join('&');

  $('#img-preview img').addClass('none')
  $('#img-preview span').removeClass('none');
  $.get(url, url_params)
    .done((data) => {
      $('#img-preview span').addClass('none');
      $('#img-preview img').attr('src', `data:image/png;base64,${data}`);
      $('#img-preview img').removeClass('none')
    })
    .fail(err => {
      console.warn(err);
      $('#img-preview span').removeClass('none');
    });
};

document.getElementById('btn-dwn').onclick = () => {

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');

  let url;
  switch(sat) {
    case 'landsat':
      url = `${landsat_services}/full`;
      break;
    case 'sentinel':
      url = `${sentinel_services}/full`;
      break;
    case 'cbers':
      url = `${cbers_services}/full`;
      break;
    default:
      throw new Error(`Invalid ${sat}`);
  }

  let scene = $('#scenes-preview .active')[0].getAttribute('data-scene');
  let params = {
    'scene': scene};

  // RGB
  if ($('#rgb').hasClass('active')) {
    const r = document.getElementById('r').value;
    const g = document.getElementById('g').value;
    const b = document.getElementById('b').value;
    params.bands = [r, g, b].join(',');
  } else if ($('#process').hasClass('active')) {
    params.expression = encodeURIComponent(document.getElementById('ratio-selection').value);
  }

  const url_params = Object.keys(params).map(i => `${i}=${params[i]}`).join('&');

  $("#btn-dwn").html('<div class="loading loading--s">');
  $("#btn-dwn").prop('disabled', true);
  $.get(url, url_params)
    .done((data) => {
      $("#btn-dwn").addClass('none');
      $("#btn-dwn-ready").removeClass('none');
      $("#btn-dwn-ready").attr('href', data.path);
      $("#btn-dwn-ready").html('Ready');
    })
    .fail(err => {
      console.warn(err);
      $("#btn-dwn").addClass('btn--red');
      $("#btn-dwn-ready").html('Error');
    });


}

const switchPane = (event) => {
  $('#toolbar li').removeClass('active');
  $('#menu-content section').removeClass('active');
  $(`#toolbar #${event.id}`).addClass('active');
  $(`#menu-content #${event.id}`).addClass('active');
  if (event.id !== 'band') updatePreview();
  if (event.id === 'band') {
    $('#download-options').addClass('none');
  } else {
    $('#download-options').removeClass('none');
  }

};

document.getElementById("rgb-selection").addEventListener("change", (e) => {
  let rgb = e.target.value;
  if (rgb === 'custom') {
    $('#rgb-buttons select').prop('disabled', false);
  } else {
    $('#rgb-buttons select').prop('disabled', true);
    rgb = rgb.split(',');
    document.getElementById('r').value = rgb[0];
    document.getElementById('g').value = rgb[1];
    document.getElementById('b').value = rgb[2];
    updatePreview();
  }
});

document.getElementById("r").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  updatePreview();
});

document.getElementById("g").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  updatePreview();
});

document.getElementById("b").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  updatePreview();
});

document.getElementById("ratio-selection").addEventListener("change", () => {
  updatePreview();
});
// Downdload UI

const overImageL8 = (e) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt(e.getAttribute('data-path'))],
    ['==', 'ROW', parseInt(e.getAttribute('data-row'))]
  ];
  map.setFilter("Highlighted", hoverstr);
};

const overImageS2 = (e) => {
  const tile = e.getAttribute('data-grid');
  map.setFilter("Highlighted", ['in', 'Name', tile]);
};

const overImageCBERS = (e) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt(e.getAttribute('data-path'))],
    ['==', 'ROW', parseInt(e.getAttribute('data-row'))]
  ];
  map.setFilter("Highlighted", hoverstr);
};

const outImage = () => {
  map.setFilter("Highlighted", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);
  $('.img-over-info').addClass('none');
};


const reset = () => {
  map.setFilter("Highlighted", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);
  map.setFilter("Selected", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);
  $('.list-img').scrollLeft(0);
  $('.list-img').empty();
  $('.list-img').append('<span id="nodata" class="middle-center txt-l">Click on Tile</span>');
  $(".metaloader").addClass('off');
};


const showSiteInfo = () => {
  $('.site-info').toggleClass('in');
  $('#map').toggleClass('in');
  $('#info-img').toggleClass('in');
  map.resize();
};

const getFeatures = (e) => {

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  let pr;
  let features = map.queryRenderedFeatures(e.point, {layers: ['Grid']});

  if (sat == 'sentinel') {
    pr = ["==", "Name", ""];
    if (features.length !== 0) {
      pr = [].concat.apply([], ['any', features.map(e => {
        return ["==", "Name", e.properties.Name];
      })]);
    }
  } else {
    pr = ["in", "PATH", ""];
    if (features.length !== 0) {
      pr =  [].concat.apply([], ['any', features.map(e => {
        return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
      })]);
    }
  }

  map.setFilter("Highlighted", pr);
  return features;
};


const updateSat = () => {
  reset();
  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  addLayers(sat);
};

document.getElementById('satellite-toggle').addEventListener('change', updateSat);

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v9',
  center: [-70.50, 40],
  zoom: 3,
  attributionControl: true,
  hash: true,
  minZoom: 3,
  maxZoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), 'top-left');

map.on('mousemove', (e) => {getFeatures(e);});
map.on('click', (e) => {

  $('.nodata-error').addClass('none');

  const features = getFeatures(e);
  if (features.length !== 0) {
    let pr;
    const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
    switch(sat) {
      case 'landsat':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
        })]);
        map.setFilter('Selected', pr);
        buildQueryAndRequestL8(features);
        break;
      case 'sentinel':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ["==", "Name", e.properties.Name];
        })]);
        map.setFilter('Selected', pr);
        buildQueryAndRequestS2(features);
        break;
      case 'cbers':
        pr =  [].concat.apply([], ['any', features.map(e => {
          return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
        })]);
        map.setFilter('Selected', pr);
        buildQueryAndRequestCBERS(features);
        break;
      default:
        throw new Error(`Invalid ${sat}`);
    }
  }
});


const addLayers = (source_id) => {
  if (map.getLayer('Grid')) map.removeLayer('Grid');
  if (map.getLayer('Highlighted')) map.removeLayer('Highlighted');
  if (map.getLayer('Selected')) map.removeLayer('Selected');

  let grid_layer,
      centroid_layer,
      grid_name;

  switch(source_id) {
    case 'landsat':
      grid_layer = 'Landsat8_Desc_filtr2';
      centroid_layer = 'Landsat8_Desc_filtr_Centro';
      grid_name = '{PATH}/{ROW}';
      landsatUI();
      break;
    case 'sentinel':
      grid_layer = 'Sentinel2_Grid'
      centroid_layer = 'Sentinel2_Grid_Centroid';
      grid_name = '{Name}';
      sentinelUI();
      break;
    case 'cbers':
      grid_layer = 'cbers_grid-41mvmk'
      centroid_layer = 'cbers_grid_centroid-bsmelo';
      grid_name = '{PATH}/{ROW}';
      cbersUI();
      break;
    default:
      throw new Error(`Invalid ${source_id}`);
  }

  map.addLayer({
      'id': 'GridName',
      'type': 'symbol',
      'source': `${source_id}Centroid`,
      'source-layer': centroid_layer,
      'layout': {
          'text-field': grid_name,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': {
              'base': 1,
              'stops': [
                  [3, 8],
                  [20, 20]
              ]
          },
          'text-allow-overlap': true,
          'visibility': 'visible'
      },
      'paint': {
          'text-color': 'hsl(0, 0%, 100%)',
          'text-opacity': 1
      },
      'minzoom': 5
  });

  map.addLayer({
      'id': `GridIcon`,
      'type': 'circle',
      'source': `${source_id}Centroid`,
      'source-layer': centroid_layer,
      'paint': {
          'circle-color': 'hsl(207, 84%, 57%)',
          'circle-opacity': 0.7,
          'circle-radius': 21
      },
      'minzoom': 5
  }, 'GridName');

  map.addLayer({
      'id': 'Grid',
      'type': 'fill',
      'source': source_id,
      'source-layer': grid_layer,
      'paint': {
          'fill-color': 'hsla(0, 0%, 0%, 0)',
          'fill-outline-color': {
              'base': 1,
              'stops': [
                  [0, 'hsla(207, 84%, 57%, 0.24)'],
                  [22, 'hsl(207, 84%, 57%)']
              ]
          },
          'fill-opacity': 1
      }
  }, 'admin-2-boundaries-bg');

  map.addLayer({
      'id': 'Highlighted',
      'type': 'fill',
      'source': source_id,
      'source-layer': grid_layer,
      'paint': {
          'fill-outline-color': '#1386af',
          'fill-color': '#0f6d8e',
          'fill-opacity': 0.3
      },
      'filter': ['in', 'PATH', '']
  }, 'admin-2-boundaries-bg');

  map.addLayer({
      'id': 'Selected',
      'type': 'line',
      'source': source_id,
      'source-layer': grid_layer,
      'paint': {
          'line-color': '#4c67da',
          'line-width': 3
      },
      'filter': ['in', 'PATH', '']
  }, 'admin-2-boundaries-bg');
}

map.on('load', () => {
  map.addSource('landsat', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.8ib6ynrs'
  });
  map.addSource('landsatCentroid', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.9sh46kql'
  });
  map.addSource('sentinel', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.0qowxm38'
  });
  map.addSource('sentinelCentroid', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.29xm4q9t'
  });
  map.addSource('cbers', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.3a75bnx8'
  });
  map.addSource('cbersCentroid', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.612drfr7'
  });
  addLayers('landsat');
  $('.loading-map').addClass('off');
});

const closePreview = () => {
  $('#scenes-preview').scrollTop(0);
  $('#scenes-preview').empty();
  $('#gridname').text('');
  $('#nbimg').text('');
  $('#preview').removeClass('in');
  $('#download').removeClass('in');
};

document.getElementById("close-preview").onclick = closePreview;
document.addEventListener('keyup', (e) => {
    if (e.keyCode !== 27) return;
    closePreview();
});

console.log("You think you can find something here ?");
console.log("The project is fully open-source. Go check github.com/remotepixel/search.remotepixel.ca ");
