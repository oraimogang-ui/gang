const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const yearEl = document.getElementById('year');
const form = document.querySelector('.contact__form');
const testimonials = document.querySelectorAll('.testimonial');
const sliderPrev = document.querySelector('.slider__control--prev');
const sliderNext = document.querySelector('.slider__control--next');
const feedbackEl = document.querySelector('.form__feedback');

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.forEach((link) =>
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    })
  );
}

if (testimonials.length > 0) {
  let activeIndex = 0;

  const setActiveTestimonial = (index) => {
    testimonials.forEach((testimonial, i) => {
      testimonial.classList.toggle('active', i === index);
    });
  };

  const showNext = () => {
    activeIndex = (activeIndex + 1) % testimonials.length;
    setActiveTestimonial(activeIndex);
  };

  const showPrev = () => {
    activeIndex = (activeIndex - 1 + testimonials.length) % testimonials.length;
    setActiveTestimonial(activeIndex);
  };

  sliderNext?.addEventListener('click', showNext);
  sliderPrev?.addEventListener('click', showPrev);

  let autoSlide = setInterval(showNext, 6000);

  const slider = document.querySelector('.testimonial-slider');
  slider?.addEventListener('mouseenter', () => clearInterval(autoSlide));
  slider?.addEventListener('mouseleave', () => {
    autoSlide = setInterval(showNext, 6000);
  });
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let hasError = false;
    feedbackEl.textContent = '';

    const fields = Array.from(form.querySelectorAll('[required]'));

    fields.forEach((field) => {
      const errorEl = field.closest('.form-field')?.querySelector('.form-field__error');
      if (!errorEl) return;

      if (!field.value.trim()) {
        errorEl.textContent = 'This field is required.';
        hasError = true;
      } else if (field.type === 'email' && !isValidEmail(field.value)) {
        errorEl.textContent = 'Enter a valid email address.';
        hasError = true;
      } else {
        errorEl.textContent = '';
      }
    });

    if (hasError) {
      feedbackEl.textContent = 'Please fix the errors above.';
      feedbackEl.style.color = '#dc2626';
      return;
    }

    feedbackEl.textContent = 'Thanks! We’ll be in touch shortly.';
    feedbackEl.style.color = 'var(--accent)';
    form.reset();
  });
}

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value);
}
