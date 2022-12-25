
// Vue.component('my-checkbox', {});
// SpeechEngine

export default {
  props: ['word','lang'],
  data: () => ({
    isplaying:false
  }),
  methods: {
    speech(){
      // var element = e.target;
      // console.log(e)
      // $(clickedElement).siblings().removeClass('active');
      // $(clickedElement).addClass('active');
      // console.log(this.word, this.lang)
      this.isplaying = true;
      var audio = document.createElement('audio');
      audio.src = this.$parent.speech({q:this.word,l:this.lang});
      audio.load();
      audio.play();
      audio.addEventListener("ended", () => this.isplaying = false);
    }
  },
  render(createElement) {
    // <span @click = 'speech' v-bind:class = "{'playing': isplaying}" class="speech icon-volume-up"></span>

    return createElement(
      'span', {
        // attrs: {
        //   'class': 'speech icon-volume-up isplaying'
        // },
        class: {
          'speech icon-volume-up':true,
          playing: this.isplaying
        },
        on: {
          click: this.speech
        }
      },
    );
  }
};
