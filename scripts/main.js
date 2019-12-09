//Global variables
let map = null;

const width = 1450;
const height = 3200;

const bottleSizeElement = document.getElementById('bottle-size');
const bottleColorElement = document.getElementById('bottle-color');
const bottleCapPositionElement = document.getElementById('bottle-cap-position');
const bottleFullnessElement = document.getElementById('bottle-fullness');
const sortByElement = document.getElementById('sort-by');
const orderByElement = document.getElementById('order-by');

let mapData = [];
let initialMapData = [];

//Zoom configuration start
const zoomFactor = 0.1;
const zoomMinLimit = 0.5;
const zoomMaxLimit = 10;
let currentTransform = d3.zoomIdentity;
const zoom = d3
  .zoom()
  .scaleExtent([zoomMinLimit, zoomMaxLimit])
  .translateExtent([
    [-width / 2, -height / 2],
    [width * 1.5, height * 1.5]
  ])
  .on('zoom', () => {
    currentTransform = d3.event.transform;
    map.attr('transform', currentTransform);
  });

const zoomIn = () => {
  if (currentTransform.k + zoomFactor > zoomMaxLimit) {
    return;
  }
  currentTransform = calculateZoomTransform(
    currentTransform,
    zoomFactor,
    width,
    height
  );
  map.attr('transform', currentTransform);
};

const zoomOut = () => {
  if (currentTransform.k - zoomFactor < zoomMinLimit) {
    return;
  }
  currentTransform = calculateZoomTransform(
    currentTransform,
    -zoomFactor,
    width,
    height
  );
  map.attr('transform', currentTransform);
};

const zoomReset = () => {
  currentTransform.k = 1;
  currentTransform.x = 0;
  currentTransform.y = 0;
  map.attr('transform', currentTransform);
};
d3.select('.zoom-in').on('click', zoomIn);
d3.select('.zoom-out').on('click', zoomOut);
d3.select('.reset').on('click', zoomReset);
//Zoom configuration end

//Define SVG
const svg = d3.select('.map');
svg.attr('width', width + 'px');
svg.attr('height', height + 'px');
svg.call(zoom);

//Load data
d3.csv('./data/wine.data').then(data => {
  initializeMap(data);
});

function initializeMap(data) {
  populateAttributes(data.columns);
  initializeAttributes();
  data = data.map(el => {
    for (let prop in el) {
      el[prop] = Number(el[prop]);
    }
    return el;
  });
  data = data.map(el => {
    el.properties = { ...el };
    for (let prop in el) {
      if (prop !== 'properties') {
        delete el[prop];
      }
    }
    return el;
  });
  mapData = fillCoordinates(data);
  initialMapData = JSON.parse(JSON.stringify(data));
  drawMap();
}

function populateAttributes(columns) {
  columns = columns.slice(1, columns.length);
  const attrDropdowns = document.querySelectorAll(
    '.control-panel .attributes select'
  );
  for (let dropdown of attrDropdowns) {
    dropdown.addEventListener('change', handleAttributeChange);
    for (column of columns) {
      const option = document.createElement('option');
      option.text = column;
      dropdown.add(option);
    }
  }

  sortByElement.addEventListener('change', handleAttributeChange);
  for (column of columns) {
    const option = document.createElement('option');
    option.text = column;
    sortByElement.add(option);
  }
  orderByElement.addEventListener('change', handleAttributeChange);
}

function initializeAttributes() {
  bottleSizeElement.value = 'Alcohol';
  bottleColorElement.value = 'Color intensity';
  bottleCapPositionElement.value = 'Ash';
  bottleFullnessElement.value = 'Proline';
}

function handleAttributeChange(event) {
  document.querySelector('.map').innerHTML = '';
  if (event.target.id === 'sort-by' || event.target.id === 'order-by') {
    if (sortByElement.value != '' && orderByElement.value != '') {
      mapData.sort((a, b) => {
        if (orderByElement.value === 'asc')
          return (
            a.properties[sortByElement.value] -
            b.properties[sortByElement.value]
          );
        else {
          return (
            b.properties[sortByElement.value] -
            a.properties[sortByElement.value]
          );
        }
      });
      mapData = fillCoordinates(mapData);
    } else {
      mapData = JSON.parse(JSON.stringify(initialMapData));
    }
  }
  drawMap();
}

function findMinMaxRange(value, min, max) {
  if (value <= min) {
    value = min;
  } else if (value >= max) {
    value = max;
  }
  return value;
}

function minifyComplexValue(value, max, modvalue) {
  if (value > max) {
    value = value % modvalue;
  }
  return value;
}

//Draw map once data is loaded
function drawMap() {
  map = svg.append('g');

  const box = map
    .selectAll('.wine-bottle')
    .data(mapData)
    .enter()
    .append('rect')
    .attr('width', 120)
    .attr('height', 150)
    .attr('stroke', 'black')
    .attr('stroke-width', '2')
    .attr('fill', 'transparent')
    .attr('transform', d => {
      return `translate(${d.x - 25},${d.y - 5})`;
    });

  const wrapper = map
    .selectAll('.wine-bottle')
    .data(mapData)
    .enter()
    .append('g')
    .attr('class', 'wine-bottle')
    //Bottle Size
    .attr('transform', d => {
      const value = minifyComplexValue(
        d.properties[bottleSizeElement.value],
        2,
        1.9
      );
      const scaleX = findMinMaxRange(value, 0.25, 2);
      const result = `translate(${d.x},${d.y}) scale(${scaleX}, 1)`;
      return result;
    });

  //Bottle Fullness
  wrapper.append('defs').html(d => {
    d.uniqueGradientId = generateHash();
    const scale = computeGradientScale(d);
    const invertScale = 100 - scale;
    return `<linearGradient id="${d.uniqueGradientId}" x2="0%" y2="100%">
       <stop offset="${invertScale}%" stop-color="white" />
       <stop offset="${scale}%" stop-color="${getBottleColor(d)}" />
     </linearGradient>
     `;
  });

  wrapper
    .append('rect')
    .attr('width', 40)
    .attr('height', 80)
    .attr('y', 60)
    .attr('rx', 15)
    .attr('ry', 7.5)
    .attr('stroke', 'black')
    .attr('fill', d => {
      return `url(#${d.uniqueGradientId})`;
    });

  wrapper
    .append('rect')
    .attr('width', 15)
    .attr('height', 35)
    .attr('x', 12)
    .attr('y', 26)
    .attr('stroke', 'black')
    .attr('fill', d => {
      return 'transparent';
    });

  //Bottle Cap Position
  const cap = wrapper.append('g').attr('transform', d => {
    const value = minifyComplexValue(
      d.properties[bottleCapPositionElement.value],
      25,
      24.9
    );
    const skewX = findMinMaxRange(value, -25, 25);
    const result = `skewX(${skewX})`;
    return result;
  });
  cap
    .append('rect')
    .attr('width', 20)
    .attr('height', 20)
    .attr('x', 9.5)
    .attr('y', 1)
    .attr('rx', 5)
    .attr('ry', 2.5)
    .attr('fill', '#CC584C');

  cap
    .append('line')
    .attr('x1', 12)
    .attr('y1', 22)
    .attr('x2', 27)
    .attr('y2', 22)
    .attr('stroke', '#CC584C')
    .attr('stroke-width', 3);

  cap
    .append('line')
    .attr('x1', 25)
    .attr('y1', 23)
    .attr('x2', 25)
    .attr('y2', 26)
    .attr('stroke', '#CC584C')
    .attr('stroke-width', 3.5);
}

function fillCoordinates(data) {
  let cx = 25;
  let cy = 25;
  let xPadding = 145;
  let yPadding = 175;
  data.forEach((el, i) => {
    if (i !== 0) {
      cx = cx + xPadding;
    }
    if (cx > width - xPadding / 2) {
      cx = 25;
      cy = cy + yPadding;
    }
    el.x = cx;
    el.y = cy;
  });
  return data;
}

function calculateZoomTransform(transform, zoomFactor, width, height) {
  const scale = transform.k;
  const newScale = scale + zoomFactor;
  const tx = transform.x;
  const ty = transform.y;
  const center = [width / 2, height / 2];
  transform.k = newScale;
  transform.x = center[0] + ((tx - center[0]) / scale) * newScale;
  transform.y = center[1] + ((ty - center[1]) / scale) * newScale;
  return transform;
}

function getBottleColor(d) {
  const value = minifyComplexValue(
    d.properties[bottleColorElement.value],
    1,
    0.9
  );
  const colorValue = findMinMaxRange(value, 0, 1);
  const colorCode = d3.interpolateOranges(colorValue);
  return colorCode;
}

function generateHash() {
  return `${new Date().getTime()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
}

function computeGradientScale(d) {
  let value = d.properties[bottleFullnessElement.value];
  if (value < 10) {
    value = value * 10;
  } else if (value > 99.9) {
    value = value % 99.9;
  }
  return value.toFixed(2);
}
