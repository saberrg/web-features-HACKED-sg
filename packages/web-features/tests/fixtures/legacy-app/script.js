// Legacy JavaScript with basic features
document.getElementById('btn').addEventListener('click', function() {
  console.log('Button clicked');
});

function handleFormSubmit(event) {
  event.preventDefault();
  var formData = new FormData(event.target);
  console.log('Form submitted');
}

// Basic DOM manipulation
function showMessage(message) {
  var element = document.getElementById('message');
  element.textContent = message;
  element.style.display = 'block';
}

function hideMessage() {
  var element = document.getElementById('message');
  element.style.display = 'none';
}

// Basic AJAX with XMLHttpRequest
function loadData() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/data', true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var data = JSON.parse(xhr.responseText);
      console.log('Data loaded:', data);
    }
  };
  xhr.send();
}
