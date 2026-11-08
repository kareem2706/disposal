// ── Partie commune (clients / fleets) — le reste est dans js/admin/25-admin.js (chargé seulement pour l’admin) ──
   // core/billing.ts
function _billingEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var _RPT_MONTHS = ['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
// Amounts kept to the 1/1000 (e.g. 9,075 €), shown with 2 decimals, or 3 when needed
// Montants : toujours arrondis au centime (2 décimales), calculs comme affichage
function _rptR3(v){ return Math.round(((v||0)+Number.EPSILON)*100)/100; }
function _rptR2(v){ return Math.round(((v||0)+Number.EPSILON)*100)/100; }
function _rptMoney(v){
  var s=_rptR2(v).toFixed(2);
  return s.replace('.',',')+' €';
}

function _rptRideHtva(r){ return _rptR2(_rideHtva(r)); }

// Bleenr wordmark embedded so the printed invoice never depends on a relative URL
var _BLEENR_LOGO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAABWBAMAAAAQzBGPAAAAMFBMVEX///////7//v7+/v3z+PSj1bhFbFMpWDsnWDsnWDonWDklWDknVzknVjkkVjgdTC/sHJedAAAaFElEQVR42s2bbXQc1Znnf7eqbZNlpLqlNgkMyCq1DTFgqUtqOGSXAWQcQ04SgmwCBLKZODNgSNjDy+wk1s4kvGTOJnZ2Zw0mk7ENM5gwYeBgwMTsBCYGy/GGnAFaKsk4ZNdWd0kCQsBS3ZIwfpGq7n6oftMbkA9z4vrUp+pW1VP3/u//+T8vLVyPj3S4n7RKv97xP+It/25HyszNdjruLf8y4tKPkzZIANTX+EMfqfzs59MOAwo7IK6c2qABUin+8EZ/evbzk93kIi+oPWU2ZvuVPHPPCWD0A4uUUFJJLaon1bFtwZnBwf5cdRkMgB2imRPhSFkaJJKSzZ4LeVeuszl6a/PTrq/KIAdAgjwRjFYfywcNaKFD6g0l7bzvjHoFp0d9YuuRP326tbdmrB1gByfETJM6Lw8CIbEDSYBDA+2cb8h3Pv7IV54Wlqqixm4IUCeE0ZNbP53X7tNLiNsLQueIPJVAIE49/OPrh/NChiUG0QSVKf8DG02wS9BtiMiK0XhEWkoFkN+V3fCTC11P6Qo8tACN0H/gmTbARiMWt5jvma7L5KFAqRIEwtSF/3rePgCEBJGcFycCPMBG6DoPM+96CLvmYmHl7zYVAqWCkqlSnBCMh4EBhSKYccv0aw679m9orpBcBCfENgSDWGpkoJTxrGuC1lorJUqGjg18/rv9UJ79EOcEMVpgNyCoQ5uRi7BR0opLM1rXNG50VAdLfE4EWKfQBFYIZ7oAZ5bATMmBiwN9jSqoNTvhvn+3Q84EoONPV5yJZrNCVbcV0KVbzrokraJEJakfWlKVtMeHHh9C4NXXz3nMsmmqN8U17IHvKMm6mnH6r63lHoBedZ/AGfyozuRDxs1hs7HIB6r0XzvbU7/TiIVOjNYCIetT11SvidM2qkLy62lHSPFBtmRGFaU4Yg5pjtCmm/CPN+taxH5ikB3kAPJqzu+MsRTpxhSAo8B5t7t6ceXXN5/RowGiobBlvKSnZ7HHdNVi4pK1OUb8WaI31yRKRpg57S8emHJ72Zgh5fqOziePGaiYbYdZH8cnsJ2i4xmxnRnxR0ZSyUxc6JGuibte2X3Sf7iqZMpjMqyB07QjQpJPfdoGCHaRkzNtNs3IS62UgD7Ubbpx7WKXPgajrSnGSR4U7BLtlTVTTlERAKo3PUhMZmDJEkghBHREDUTRYCDQIMPM4ujvwzcBdIgCodGJc5nF7H0rm0+7G+DorcH23MyZdvPnXWNvBmDdKe9214ak7sLKZgiMyEse9PrGYHsl+hDV0Go0QFl9y2WJ8gBGgSD5rfDdfW7XXYnmOGVQDkqFANMccHAPA0KqZIuI9oHDVz1OsF6BuGzrEXHAbO+ZanMuv3LpJt75X8BZG7hpYdUgBKffHcO2NfL7G2l57ZoNzmgX3Lz1CJVB8VBFV0ziN72xqobyZtJl9BvpO2UxXYLYRdE0KhDt0fmZzW9vuurSHgOef37BYze/Yk6Z67TTc82Gpi6uXi16mexiwwKedvurENl9ZV90x8uXgdu3+vG3uzIZ9GY+9fhND+XyxjREikL2tVXV2E+T3zHd6uHdNdjTumL71NWP5p2zKVjwTW22A6uvvuKhrefnRQ2lC/JXP17/1E1rZXqnb7L2xs3HHlm1r8Ya9Wp9z4AG8tc93DP/m50gMtec/sz9V3jOjF20uGwzBiCmu+W4oJwspq8ru1griMyp44Rs3/+fNh6WwWgYAXiYq4OtN/TXV8NIo/GyxwO7DS1EJy3uIXUZJ/34olyVh5R8peNFCS2X/fhI82RhB0Bvf8djj14kZwqO5bXSVCdiQlRIXWvpj4mo05/in8y8QMmaWRzPf/V/9gSiLXBUHnA5ED9hbDk0HJRvy0X7n+66oSAJJRNf8IiN1r+dOOkni9yosmBe4lJeu6VrdV+yRGbkbmDDkocSeFUtiBpkjdFqpkxWDUJjmo43bU/VxuLabvr4QyqjLCGCCOCpqxfLtbr/rGGrEli+dsupa0WzAliooH3HG1/TcnjNthqxKPrkngu4dP1bumO37wCRGZ9/unQOhr3TVJKsjVyEAj3F6QsEQks5TQ5M47yx/c+HMoj9AhITyOQnHgjCpo+5RhlW0aUbFwAqtNBEYMZrUOGO+y+qq/U8ylKcfYTJotuU3GWqeb9cv8SYBhAxJXKxROVMCSCauGGM5ZiALyqirgJFPQYNuil7NC4kLG66KDniG3gT+c9kLyoRiLn/ym2f2+WOCmXZgU6tUFyjpK2tLUt2VzSFByr2jfWHdwkdlGR8j3hBnrqursUDFg1PFZgVTCtLlOZTlUy3kenSOKdYCWzzZcNFvbKFvb+nJz/cqSSqIXQHHfBxDtCZ2tA4jLCUO9z4ie+MjboqLVyQWgQJDEXr6TddYdWweeeOiS997wwlq5JXS+ZvuMJHWAyJ2WNENV0UKqHNaJno7tSA/vpLpQXQAO5YyYXZddeTVTl8V/NKGBWRgfDO99lx5i0n16MViv1fGFeCtJBB0VKBUxSLJaDtIxsaR8vvunjeC55Mj1wpX9CqVt+JpjeHQaVlOEdgK5Q9VYdr0exdEnSgXQ9hdbeqWrFRRnRKdrc6785r0cbY1aP9GdeMiz2vAq6ad1HoWWM0Zu9mMkx3Z61kL77XEShAWA23LahHaDkOHI5AqtQfKUIhW+cltBJiT8T31WNEc0fj5VVZXHJ1OZi89AfvyQDPbNmvp8jDfZlk+9pG/8sjfc4pgZcTdWF6OehDZudO1sJxf0mvWxTpvivv/qoWgWsPOsIGluu+pmQhxcc6RqHXBGfER6o87mAAqX9ZMwlaCEsARsdI3wekEBKMV1yHExfVysf3J1t53uB/ae2dqYARjdnQdEDkxLGlC9YqaNj8t6vpBOYtuK++TplcepciwFYc23P5bQrE2V3fWwNIVNg4CnIc/FbpoYXpoYU4fnzr6jKq4WjdyFzZzlSFUKJCxSec13C2tUhhB2Qnbr1mZtymQxmmmmQR8Nwz5n+/sB1IBY/d2Thv2xpgrGPEIzr7mUs0YB0/+sk/3Q6wsqvrfUBg2X9X78bKBOfkMRREqLH6YN56/bzvlNjNQIJK6zmMloBDfNZZlZMLNh3d1tr8boq2uP14d90Mm4W1mP69waiNcjPPXPtydw6Inrxu25FCJwi9uXEU9r88HgCkabp+Rw7g52pzR6svgd81ubE2AP9sEwTk+v580/qjN4nNnxkZtP7BATmqF+4DxxNzz7Tv9G2pnhztWtJm+/KQqc1/2uMWpqp+ADEir3sfWwPHrr1+b65AGKfdJ091EslwXWM92dNLj9YnXb8z1+MyRG7iV3cntHHKscZhYhPgaQdgR9PEHWuDQFx2zvpQXpWHcTV5z0ZLfSA8OhnuqrDNEvdbgiIBHgfu+mE8ywrpsbTUfQ5K2Zvf3OmSKcSm4y/71cbREMASuHGm9JXh2p1u3B7jUMj865qNjgKK56UHh+Q4MG9NN0Dj5Oa3XvHSjV43FxeXAZwSCZpn7iatypSnMaORa6uCIC6S0UT73Ik/X4Uv7GBGqqO5/9URV0HDaes+29LTPqCcoYIz1HjHoisFMCYvGu9P3IdYuOCptkJG+zjFsJB79MHxJNXw3UWtRYCJckz2rQuHcwUzF/3q3tFDQBT3XXKxmhG/j75QqaUI8vvoOfDEEweeOPDUE089kfei7YBbt3TtzphKssatfO44QqNAOyfdudfXPQo/Vl6T+fo3bAWk1kuWa6WAbeLLbT4UNX6zNLjwL5MnTMhyjuUffYDWq75sRgVDx+bx20ted/AxSzM61eZ3X8hJYeeMKlb7cqRz6WyuLScZbI8iD3/BARes2eqMl4fJLvcOti6W2DZCNgh2G0WpAJfotHsUwHXzn40xkncbDuOvS7TWDIUXJ0JDrgEQ0fydsTAWqbGC+Zsk5gvVzCxJvNfNK4K8gSESSRHpvKt6QxsdEWW8cYF/ShHP0LPtBt2wQyBjhwt24jcTBEjlwLnf2oGE45cPp759uwXw2C1Zg2RDGY7G3x1pgRoR/2aVnjvvC4B+7lbXD2Igw4sn1wikhikvfarFw9DYKWItKMkyT7RrBSZpne0BNbLwfMYzurwdvAqnx6ZsApWetA+7XqvRLHQiBAz/oaJESO2ZZ7ylBeGyrs/HQwSZGD8TC4Ej/rK1Q2FGHkKOA2z7HKJu3OmLAwKtwGz7fqeSoM0ZrkW35yGGwCjJ0uSzMyW7pBA5Fzdd/4PzIz3oTMc0Rt+9LtgIdVtcb2DLkngRP5MCwXO3tly3AAG8951uP3YyGIZIlnRS+bqQJ1GRwPw183x9uOXa4aG2ctQd7pjDe48OmJUgQIPpdpjQjnSRiHJIKSy7+IPz+rU/LR8EiKRW6nvKyNQ+N4sEJUeSMEMX9hx0M8mAUtnUVLepGIys3S9LkWYnwtHelBykStJDUx2L/kUpKUoKBBpMXC9eoWQYoht821J4TAahw/0HQ2caPrQyibTXVFwkGJmawEvdkb24sGLpF429AKLhU1+c5k9N82SpBOLkezb6JoCyPCZ/9msZV/bd2xufUCA1IKmRprryqBRo0YaZP5+rhGhIkN8QaADPbCsWf/rDbP00TAMixonpbXi7xvknSWNtZMWd7h8feQtgz7+4Rtu0RR5D0N1REkwgNaa789CiYlkYj8+XSdESDOKafMRIJWRNAfSexwr1yuPOUHYsHmuKwyLzOiMzAi3kl5xLglKhyK2ZVROEliz50jSTDvXTlzoYZe79KuiQg3XZe6dlg3scd1+HfOXi6uJHXhkSgEpMk8HMBKJXdeMCRHeH4uYp+NkyLzLdvJCBWJ/prYQt5dvqLjDQaIN9uRC0XY2LzWz4R9nx/b1BgOaddXXGbjXNmbpRdwSuIEgnvOb2RhJjrMwGvq7W4I3ae/fUli8EdBDNv6Y28rU3ax4k9yrEJ91X3zw2AuAP2E2+uwdw5msY8cDo0aGGcoaaaFDbn9Td6ci3IPpUwU0fj0Upxo57aVZaeBGmLFeilFR0S6NmVqUcq07daG1IVY1jUpWUbW1+moWj53w9o6zFAxjLj3aMJo7ccXpkaY0MkC8AsefW6T3S/cdSOclblhoZfrglO96kEIfv7as77b9/VaFBxD3nFXIjZkFVuVM1glJWB/2tz8TlOkBNOmhqRkvPDAJ6r02vqA0Fn1i5phibLWCKn9aNiOSRkcZ2+kruKvnuKA8deLZs6GnQtl7+wNWGHkpJ+aKDPrbuov6fPyKcJCxevOsSdcb/SfZFjTVSm9Gic9AymKVSJNFzS9MnOzUjykNoSgFa7pWuv58YelES+87C4QRbwnTLD1WVbIjQeNA6GGbNQENKvnPBL8Re7Wg1drb2clEnAUKjlbUi0mEtQ8pShcGLHC0qm0K5/aI2k1S7G7yaBCRcVfL12gaBVsSFJU+pdJ+EICPv86opnkBNc66GKzFNQ2JiERxfpZ67K/uZ93ol0v3NLS1nz+9VoAOtEBNmvdmRyyVLrcpAUAqzWlabu5o0raAPRGZStBfYUiuhwdAX3jO2HJAFDSOU8pSmK8vFsTfKfKWIRnq1LowMBLyv4WBdZmezEDpqHU5JLB0kfOb1R17ey+en54slkUbIDzc18mZsRNACK7AREhsjZvzt+qI5IhkLhRv1WQDdf1J+4fGYQ4keKFU3dsnADusRCy9cVy92B3hNcrJ+j/glmYJUuwoZf5FPsQrQZZU8l9RuXkhj9oLO1PmNpxptRq5KdH2lYlYw9k1IF9D7ltaFVgjQUb7NuxwWLgS9ZOYMHc4u1J7rBmH61mXZw4hclRBrjyNuMSm7Aq6KpxBFCYImGErMKH1CKsG3GcsZuNFIrSKMjudkmFQMhLAPoRCYvSBVtDD0/nmGNe9GS7d1BgAjpvTcozfNVQm1hhrBawbXu2iKF0EmVkcf0O/h5by568bFOuH7oASYQgYKdw8g1QS+NIH/1z2jBGe8OgbYv1vwrHg1wJo5olySloCjweucYZ+Ss9VQa4yOZ620xpl+AxHIKj1FlT44G23g+spWIj1j6eOPJwBdcGc2reFIeta+UGJfmY20KQmuwBRlno4BhZwGiGkeURrz5lgGAVpoImcPhjITL6hAgmogBVjHo5Q9jaF8x1iaMPnDB6PTFBh1AAXHx2CRX612O0gTehtDq1ppLjs+qVDWB1GeijFnKyCP4cYqlGCoKal4D5Cx9V0VCnHYd++bBi1H9G+sRwM3jaeaJEHwQ1UAx3eIY19hZIachGmNJDTW1UbGmrfMBo+4tkllogz5KXK9lbMXFCXC9mpOa6mSUU1qB5og9sY6Yh+/pgFh8vpnxgBGrO7+byvEhOFTKPiUIhzNon5HoRkMLAV6smSdDmolhpYf1qQyb+JNWrylSthaAM5Q7Bi+Q51UbQqJO17CdAwCeTihUOVaATZ1mxtVXKBAkHSUkdn/ajL3z25pyf7N7QpzwxWhBxQAGhyf4YuVRAdJIVAAygv/pNo3Zyab5kM94jwnAqTWSoH2Y/yCg/zlbZV1UZXeJSVKa/t2ZySEdIZu/ru+ptJSCAMy/vUiA8jAPZSSqwCx5ie/qMrtnjjKLB5CY0utgKYlIdBGjUt0PpIbj6KIHYAec4AxDU6GeM83tpUxcywRBIYPVgMSMMRuy0T4UqWOf36fTMARN9IQ5R4SPojJdy97tm+jA2h59IrFQelVscy89h83tTjV4pOvBXizmJrkCOIPzE/DuNlGulzwV6nVG30UKO2vWNrilOdABO4ecHw/FhDLfMbLPfrZ8Xw6N6Cgrz3af4nnOMD/XnVbdmHoNYHQgz85OddT2kiZkdXrn1vydIV05aGFWrljTO+SAi0+CNMVT1+la7HCtrc81KkSGSoshSoTTD1OX+xrlt3e0mYXXcZ37T/zgRyx47n73Oi1b/y1SDa+PISWTQCjx47f8GAu9gHDya/c8L2vXH5wvFjvowHvs0LJKK7Rdmpm2XAuo51Y1cbVCzYRdCI1ASjvFGjrh1hJGHvDB0Rs+t8JkXhNuZalPCDayeHmU9dteF9YAOe8v1P2H5VKC8TH9f1qu2gHovzKc6zb1b8teajel0poECmkon0uEz+kfGHoLdN7zbQOCezIfe3HblXFxu4eEE2+33+yEnbgGoHQWynuAsyVSzcpgQC8PZvdQmvXspwFBA1HH7ELLwCpq/94o8jbSzcdVATCGoesstFGz0X692qbS5Xd+vNTXFtGqpyESTEpvPeCyBMNpe82vBKXZrvu8i09miY/kN/627sU2Kfd9Vf/1QDQrZ+6IiZWi5wAEAMTP9u6LqPA3vL2nZ87RQWbz9tYh1YmqHoLEbm/dzMhsYEMMJqrSivnuWBrEUiZd5dl/6kEeulXlstwJgu2ikmDzhhdXVsBfnPnN5VEC8Sel7otw3h08xGVJAMu7vpvEtDrL1+FkPqWuleVV1r/0Jqtf8+MPjxyCVCBmtLQZ9tKYKsI87ex5yHLwbEs93cNP4dsEEhysbpcB0EQFD7xF4kn65lYfrDVdvxzb+5O6nrauFwHwWivWrvIkSDeOLqkohysUkIxnNK0E83ZWlg1Gl3rhSSuKG+CXL/9n7NOuWhe20p37podZJoFGFHBB7A9LQAR5X49f6cP0ny9s/T4+nofhIMSClAyus9zyxyhMOKP6lIq8DDcflCIqkapQkz+ouW0C3YmDYpESFUKtzRGnPrnre+F9Qqhc96BVzVOusQBQl98VVJ5i+/IXoKSCFg0ICKz+xIgkDK+v681wWLwsZAIA/F7bkTtGSBk1Wbhq1xJ0qpz87/d7mJ51mhjqXPC3QPaSzvoc9aeemOfAwFusMKIzKBcz7r/zZ2xBkn8+vq3kIAdhLYI4z8LAMIdx++sr1O5POAv0uCpFu1XJL6fNHK63nTKm6Ly2jGRgQTTxQXTUCbaSsLvw9eu86K8l2yXpBDpoGHEjwfMR7//07ZBCUh7MBgLyvgy1h1sscyBqOCLF7ssWyTuT2DJAoAtv3Hzl11KW00CtMtp5bPYnwXOumamzYWrx7DzaRrHuFrPi5v9ZqWFJYQW2s4vX8VgGVAuUqkhH4RUsa8K5173mHaVjRbVhqLIfPKGL+6NQHl2XGh5Kd2dJZDJBwmpDRmZwUmjO1tUgjPHW65fUNMtzNSPyaS2pIzZ4i2DSWnCaENUL7BRlhQCbKmlLNgD/3DjjTvjarNtPJhkmrQiwGb8yduPAXbiUAYTZfnyF9fuaC1RkjE0ce0lO7QoXdP2mMTUDy+4pWOwHCgSjNA+pTUKgDApPwjZOCumt/1VryYWAoUYHR1yVTFJzYhscddnvr32wVzSKBtDXSEuNg2eqSt9ZbLuR/LmF7NkVGn7xob3f7/0vQOtQ4lBSmI+9bUHH7nYd4OknUvl09a2u6/aW18OCHVjXgs/aq1tkTHwsfoa4rdANQyLWfCR+tqCFbPuUC1u5MhXaposuaHELX9WaUk0zn2Juwmi0Eo6zkyrbfmvX9k3Um6+yRT8ZY/Ke9XiwA4SfsvZ6rs3/tQtNwMZy5PazNFq3lFU3qT+Aq1mFXvGXAQpeH3tFdtzAzUl6fKKohUEVqBHh3/+0u3s6rOS9Y2LoVx7y95FlaR/gXj43B/dJnWPkoCkcbs6ae2D2Z4K6cqyoc7MtNLcIVdqrlxKwOgLZm5AVVrFj5RHquQLfJCO83Nu2sLI/wC4vK3tyNoDe7PFSmN3YOvIPPdHb29YEWxRwLXNN75+5/ZcQUo/4a/fzvr2m6o9jePT3PsM2WobMJr1bC2SKFW0V/60KhVVnBiLwgBwfCkCcgPvrbKTVmTdFQTb002jg9WOB6lgcZ23svnUe0ojDnTn4mItWZj1ENQ8HUjHmQGFHG/xEE1+JW1SbQUXs/+5YLGckqacmv+b2hYZeanl0gatgl3kohnZKkO4efPS8gjTHZktmTvn35NrLlR//n8jUMJsHqDY5AAAAABJRU5ErkJggg==';

// ══ Invoice engine shared by the client, fleet and admin spaces ══
//   prestation : the fleet invoices the client (one invoice per fleet + client + month)
//   commission : Bleenr invoices the fleet (one invoice per fleet + month)


// Identity of the parties. RPC invoice_parties lets a client read its fleets (and vice-versa) despite RLS.
async function _invPeople(ids){
  var map={}; ids=ids.filter(Boolean);
  if(!ids.length||!sb) return map;
  try{
    var r=await sb.rpc('invoice_parties',{ p_ids: ids });
    if(!r.error && Array.isArray(r.data)){ r.data.forEach(function(p){ map[p.id]=p; }); }
  }catch(e){}
  var missing=ids.filter(function(id){ return !map[id]; });
  if(missing.length){
    try{
      var q=await sb.from('profiles').select('id,email,role,client_type,company_name,first_name,last_name,vat_number,address_street,address_postal,address_city,address_country').in('id',missing);
      (q.data||[]).forEach(function(p){ map[p.id]=p; });
    }catch(e){}
  }
  return map;
}

// Sequential number, stored in fleet_invoices (same number when re-generated).
// RPC invoice_number works for the admin, the fleet and the client.
async function _invNumber(fleetId, kind, clientId, period, a, count){
  try{
    var r=await sb.rpc('invoice_number',{ p_fleet:fleetId, p_client:clientId||null, p_period:period, p_kind:kind,
      p_htva:a.htva, p_vat_rate:a.vatRate, p_vat:a.vat, p_tvac:a.tvac, p_rc:!!a.rc, p_count:count });
    if(!r.error && r.data) return { number:r.data };
  }catch(e){}
  // Numéro attribué uniquement par le serveur (fonction invoice_number)
  return { number:'PROVISOIRE', warn:'Numéro de facture non enregistré (fonction invoice_number indisponible) : document provisoire.' };
}

function _invPage(o){
  var e=_billingEsc;
  var rows=o.rows.map(function(r){
    return '<tr><td>'+r.desc+'</td><td class="c">1</td><td class="r">'+_rptMoney(r.unit)+'</td><td class="r">'+_rptMoney(r.unit)+'</td><td class="r">'+_rptMoney(r.vat)+'</td><td class="r b">'+_rptMoney(r.total)+'</td></tr>';
  }).join('');
  return '<div class="page">'
    +(o.warn?'<div class="warn np">'+o.warn+'</div>':'')
    +_docTop(o.title, o.number, ['Date : '+_docDate(), 'Période : '+o.periodRange])
    +'<div class="parties">'+_docParty('Acheteur',o.receiver,false)+_docParty('Vendeur',o.issuer,true)+'</div>'
    +'<table class="lines"><thead><tr><th>Description</th><th class="c">Qté</th><th class="r">Prix unitaire HTVA</th><th class="r">Sous-total</th><th class="r">'+o.vatHead+'</th><th class="r">Total</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="sum"><table>'
      +'<tr><td>Sous-total HTVA</td><td class="r">'+_rptMoney(o.base)+'</td></tr>'
      +'<tr><td>'+o.vatHead+'</td><td class="r">'+_rptMoney(o.vatAmt)+'</td></tr>'
      +'<tr class="grand"><td>Montant total TVAC (EUR)</td><td class="r">'+_rptMoney(o.total)+'</td></tr>'
      +(o.vatNote?'<tr><td colspan="2" class="note">'+o.vatNote+'</td></tr>':'')
    +'</table></div>'
    +'<div class="box"><div class="boxt">'+o.boxTitle+'</div>'+o.boxBody+'</div>'
    +'<div class="foot">'+e(o.footer)+'</div>'
    +'</div>';
}

// o = { rides, kind:'prestation'|'commission', year, month, title, settings?, people? }
async function _invOpen(o){
  var win=window.open('','_blank');
  if(!win){ showToast('Autorisez les fenêtres pop-up pour générer les factures'); return; }
  win.document.write('<p style="font-family:sans-serif;padding:30px;">Génération des factures…</p>');
  try{
    var e=_billingEsc;
    var rides=(o.rides||[]).filter(function(r){ return r.driver_id && r.final_price && !r.is_subcontract; });
    var s=o.settings||await _docBilling();
    var cfg=_invCfg(s);
    var people=Object.assign({}, o.people||{});
    var need=[...new Set(rides.map(function(r){return r.driver_id;}).concat(rides.map(function(r){return r.client_id;})))].filter(function(id){ return id && !people[id]; });
    if(need.length) Object.assign(people, await _invPeople(need));
    var p2=function(n){return String(n).padStart(2,'0');};
    var period=o.year+'-'+p2(o.month);
    var lastDay=p2(new Date(o.year,o.month,0).getDate());
    var periodRange='01-'+p2(o.month)+'-'+o.year+' — '+lastDay+'-'+p2(o.month)+'-'+o.year;
    var pLabel=_RPT_MONTHS[o.month-1]+' '+o.year;
    var bleenr=_docBleenrParty(s), footer=_docFooter(s);
    var fleetParty=function(id){ return _docProfileParty(people[id]||{company_name:'Transporteur'}, true); };
    var clientParty=function(id){ var p=people[id]||{first_name:'Client'}; return _docProfileParty(p, p.role==='driver'||p.client_type==='pro'); };
    var rideRow=function(r,vatPct){
      var h=_rptRideHtva(r), v=_rptR3(h*vatPct/100);
      var dur=r.trip_type==='disposal'?((r.notes||'').match(/Durée:(\d+)/)||[])[1]:'';
      return { unit:h, vat:v, total:_rptR3(h+v),
        desc:'<b>'+e(_DOC_TYPES[r.trip_type]||'Course')+(dur?' ('+dur+' h)':'')+'</b> — '+e(r.booking_code||String(r.id).slice(0,8))
          +(r.status==='cancelled'?' <span class="cx">(annulée, non remboursée)</span>':'')
          +'<div class="sub">'+_docIso(r.ride_date)+(r.ride_time?' · '+String(r.ride_time).slice(0,5):'')+' · '+e((r.from_address||'').split(',')[0])+(r.to_address?' → '+e((r.to_address||'').split(',')[0]):'')+'</div>' };
    };
    var pages=[];

    if(o.kind==='prestation'){
      var groups={};
      rides.forEach(function(r){ var k=r.driver_id+'|'+(r.client_id||''); (groups[k]=groups[k]||[]).push(r); });
      var keys=Object.keys(groups).sort();
      for(var i=0;i<keys.length;i++){
        var list=groups[keys[i]], fid=list[0].driver_id, cid=list[0].client_id||null;
        var vatPct=cfg.vatFor((people[fid]||{}).address_country);
        var rows=list.map(function(r){ return rideRow(r,vatPct); });
        var base=_rptR2(rows.reduce(function(a,x){return a+x.unit;},0)), vat=_rptR3(base*vatPct/100), total=_rptR3(base+vat);
        var num=await _invNumber(fid,'prestation',cid,period,{htva:base,vatRate:vatPct,vat:vat,tvac:total,rc:false},list.length);
        pages.push(_invPage({ title:'Facture de prestation', number:num.number, warn:num.warn, periodRange:periodRange,
          issuer:fleetParty(fid), receiver:clientParty(cid), rows:rows,
          vatHead:'TVA '+vatPct+' %', base:base, vatAmt:vat, total:total,
          boxTitle:'Réglé : '+_rptMoney(total),
          boxBody:'<div>Paiement effectué via la plateforme Bleenr — aucun montant supplémentaire n’est dû.</div>'
            +'<div class="muted">Prestation de transport réalisée par '+e(fleetParty(fid).name)+' via la plateforme Bleenr.</div>',
          footer:footer }));
      }
    } else {
      var byFleet={};
      rides.forEach(function(r){ (byFleet[r.driver_id]=byFleet[r.driver_id]||[]).push(r); });
      var fids=Object.keys(byFleet).sort(function(a,b){ return fleetParty(a).name.localeCompare(fleetParty(b).name); });
      for(var j=0;j<fids.length;j++){
        var fl=byFleet[fids[j]];
        var htva=_rptR2(fl.reduce(function(a,r){return a+_rptRideHtva(r);},0));
        var pv=cfg.vatFor((people[fids[j]]||{}).address_country);
        var pTvac=_rptR3(htva+_rptR3(htva*pv/100));
        var fc=(people[fids[j]]||{}).address_country;
        var cRate=cfg.commFor(fc), cVatR=cfg.cVatFor(fc), cRc=cfg.rcFor(fc);
        var cHt=_rptR3(htva*cRate/100), cVatAmt=_rptR3(cHt*cVatR/100), cTvac=_rptR3(cHt+cVatAmt);
        var numC=await _invNumber(fids[j],'commission',null,period,{htva:cHt,vatRate:cVatR,vat:cVatAmt,tvac:cTvac,rc:cRc},fl.length);
        pages.push(_invPage({ title:'Facture de commission', number:numC.number, warn:numC.warn, periodRange:periodRange,
          issuer:bleenr, receiver:fleetParty(fids[j]),
          rows:[{ desc:'<b>Commission plateforme ('+cRate+' %)</b><div class="sub">'+fl.length+' course(s) — '+pLabel+' — base HTVA '+_rptMoney(htva)+'</div>', unit:cHt, vat:cVatAmt, total:cTvac }],
          vatHead:'TVA '+cVatR+' %', base:cHt, vatAmt:cVatAmt, total:cTvac, vatNote:cRc?'Autoliquidation de la TVA':'',
          boxTitle:'Retenu : '+_rptMoney(cTvac),
          boxBody:'<div>Montant déduit du versement de la période — aucun virement à effectuer.</div>'
            +'<div class="muted">Prestations TVAC '+_rptMoney(pTvac)+' − commission TVAC '+_rptMoney(cTvac)+' = <b>net versé '+_rptMoney(_rptR3(pTvac-cTvac))+'</b></div>',
          footer:footer }));
      }
    }
    if(!pages.length) pages.push('<div class="page"><div class="box"><div>Aucune course facturée pour '+pLabel+'.</div></div></div>');
    win.document.open(); win.document.write(_bleenrDocHtml(o.title||((o.kind==='prestation'?'Factures de prestation':'Factures de commission')+' — '+pLabel), pages.join(''))); win.document.close();
  }catch(err){
    console.error('invoices', err);
    win.document.open(); win.document.write('<p style="font-family:sans-serif;padding:30px;color:#C0392B;">Erreur : '+_billingEsc(err.message||err)+'</p>'); win.document.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// PASSENGERS (pro clients)
// ═══════════════════════════════════════════════════════════════
var _editPassengerId = null;

var _dInvSelMonth = new Date().getMonth() + 1;
var _dInvSelYear  = new Date().getFullYear();

window._dInvStep = function(dir){
  _dInvSelMonth += dir;
  if(_dInvSelMonth > 12){ _dInvSelMonth = 1; _dInvSelYear++; }
  if(_dInvSelMonth < 1){ _dInvSelMonth = 12; _dInvSelYear--; }
  window._renderDriverInvoiceMonth();
};
window._dInvSetMonth = function(m){ _dInvSelMonth = parseInt(m); window._renderDriverInvoiceMonth(); };
window._dInvSetYear  = function(y){ _dInvSelYear  = parseInt(y); window._renderDriverInvoiceMonth(); };

async function loadDriverInvoices(){
  if(!sb||!currentUser) return;
  var el = document.getElementById('d-invoices-list');
  if(!el) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';
  await window._renderDriverInvoiceMonth();
}

window._renderDriverInvoiceMonth = async function(){
  if(!sb||!currentUser) return;
  var listEl = document.getElementById('d-invoices-list');
  if(!listEl) return;

  var monthLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var curY = new Date().getFullYear();
  var minYear = Math.min(curY-2, _dInvSelYear);
  var maxYear = Math.max(curY+1, _dInvSelYear);
  var yearOpts = '';
  for(var y=maxYear; y>=minYear; y--){
    yearOpts += '<option value="'+y+'"'+(_dInvSelYear===y?' selected':'')+'>'+y+'</option>';
  }
  var monthOpts = monthLabels.map(function(ml,i){
    return '<option value="'+(i+1)+'"'+(_dInvSelMonth===i+1?' selected':'')+'>'+ml+'</option>';
  }).join('');

  var btnStyle = 'background:none;border:1.5px solid var(--sand3);border-radius:6px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:inherit;';
  var selStyle = 'font-size:13px;font-weight:600;border:1.5px solid var(--sand3);border-radius:6px;padding:3px 6px;background:var(--white);cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--ink);';

  var m = _dInvSelMonth < 10 ? '0'+_dInvSelMonth : ''+_dInvSelMonth;
  var from = _dInvSelYear+'-'+m+'-01';
  var lastDay = new Date(_dInvSelYear, _dInvSelMonth, 0).getDate();
  var to = _dInvSelYear+'-'+m+'-'+(lastDay<10?'0'+lastDay:lastDay);

  var {data} = await sb.from('rides').select('*')
    .eq('driver_id',currentUser.id)
    .in('status',['done','confirmed'])
    .not('final_price','is',null)
    .gte('ride_date',from).lte('ride_date',to)
    .order('ride_date',{ascending:true});
  var monthRides = (data||[]).filter(function(r){ return !r.is_subcontract; }).sort(_byNewest); // sous-traitances : hors facturation
  window._dInvCurrentData = monthRides;

  var fmt = function(v){ return parseFloat(v).toFixed(2).replace('.',',')+' €'; };
  var tLbl = {ab:'A → B', disposal:'Disposition', mixed:'Mixte'};

  var header = '<div class="card-hd dinv-hd" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">'
    +'<div class="dinv-nav" style="display:flex;align-items:center;gap:6px;">'
      +'<button onclick="_dInvStep(-1)" style="'+btnStyle+'">&lt;</button>'
      +'<select onchange="_dInvSetMonth(parseInt(this.value))" style="'+selStyle+'">'+monthOpts+'</select>'
      +'<select onchange="_dInvSetYear(parseInt(this.value))" style="'+selStyle+'">'+yearOpts+'</select>'
      +'<button onclick="_dInvStep(1)" style="'+btnStyle+'">&gt;</button>'
    +'</div>'
    +(monthRides.length
      ? '<div class="dinv-btns" style="display:flex;gap:6px;">'
          +'<button class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:5px;flex-shrink:0;" onclick="generateDriverInvoices(\'prestation\')">'+t('app.factures_prestation')+'</button>'
          +'<button class="btn btn-secondary btn-sm" style="flex-shrink:0;" onclick="generateDriverInvoices(\'commission\')">'+t('app.facture_commission')+'</button>'
        +'</div>'
      : '')
  +'</div>';

  if(!monthRides.length){
    listEl.innerHTML = '<div class="card" style="padding:0;">'+header
      +'<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px;">'+t('app.aucune_mission_ce_mois_ci')+'</div>'
    +'</div>';
    return;
  }

  // Amounts from Admin → Facturation: commission % (on HTVA), its VAT, and VAT client -> carrier (fleet country)
  var _s = await _docBilling();
  var _cfg = _invCfg(_s);
  var pVat = _cfg.vatFor(currentProfile?.address_country);
  var _fc = currentProfile?.address_country;
  var cRate = _cfg.commFor(_fc), cVat = _cfg.cVatFor(_fc), _rcD = _cfg.rcFor(_fc);
  var r2 = _rptR2;

  var totHt = 0, totComm = 0;
  var cell = function(v, extra){ return '<td style="padding:10px 12px;font-size:12.5px;text-align:right;white-space:nowrap;vertical-align:top;'+(extra||'')+'">'+v+'</td>'; };
  var rows = monthRides.map(function(r){
    var ht = r2(_rideHtva(r));
    var cm = r2(ht * cRate / 100);
    totHt += ht; totComm += cm;
    var code = r.booking_code || r.id.slice(0,8);
    var from2 = (r.from_address||'—').split(',')[0];
    var route = r.trip_type==='disposal' ? from2+' (Mise à disposition)' : from2+' → '+(r.to_address||'');
    var timeStr = r.ride_time ? r.ride_time.slice(0,5) : '';
    return '<tr style="border-bottom:1px solid var(--sand2);">'
      +'<td style="padding:10px 12px 10px 20px;font-size:11px;font-family:monospace;font-weight:600;color:var(--ink2);vertical-align:top;white-space:nowrap;">'+code+'</td>'
      +'<td style="padding:10px 12px;vertical-align:top;"><div style="font-size:12.5px;color:var(--ink3);">'+formatDate(r.ride_date||'')+(timeStr?' · '+timeStr:'')+'</div>'
        +'<div style="font-size:12.5px;color:var(--ink);">'+route+'</div></td>'
      +cell(fmt(ht),'font-weight:600;')+cell(fmt(cm),'font-weight:600;')+cell('','padding-right:20px;')
    +'</tr>';
  }).join('');
  totHt = r2(totHt); totComm = r2(totComm);
  var pVatAmt = r2(totHt * pVat / 100), pTvac = r2(totHt + pVatAmt);
  var cVatAmt = r2(totComm * cVat / 100), cTvac = r2(totComm + cVatAmt);
  var net = r2(pTvac - cTvac);

  var th = function(l, right){ return '<th style="padding:10px 12px;'+(right?'text-align:right;':'text-align:left;')+'font-size:11px;font-weight:700;color:var(--ink2);white-space:nowrap;">'+l+'</th>'; };
  var lbl = function(t){ return '<td colspan="2" style="padding:6px 12px 6px 20px;font-size:12.5px;color:var(--ink3);">'+t+'</td>'; };
  var sep = '<tr><td colspan="5" style="padding:0;border-top:1px solid var(--sand3);"></td></tr>';

  listEl.innerHTML = '<div class="card" style="padding:0;">'
    + header
    + '<div style="padding:14px 20px;border-bottom:1px solid var(--sand2);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+t('app.total_brut_htva')+'</div><div style="font-size:18px;font-weight:700;">'+fmt(totHt)+'</div></div>'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+t('app.commission_bleenr')+cRate+'%)</div><div style="font-size:18px;font-weight:700;color:var(--red);">−'+fmt(totComm)+'</div></div>'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+t('app.ca_chauffeur')+'</div><div style="font-size:18px;font-weight:700;color:var(--green);">'+fmt(r2(totHt-totComm))+'</div></div>'
    +'</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr style="border-bottom:2px solid var(--sand3);">'
        +'<th style="padding:10px 12px 10px 20px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.code')+'</th>'
        +'<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.trajet')+'</th>'
        +th('Tarif HTVA',1)+th('Commission HTVA',1)+'<th style="padding:10px 20px 10px 12px;text-align:right;font-size:11px;font-weight:700;color:var(--ink2);white-space:nowrap;">'+t('app.a_payer')+'</th>'
      +'</tr></thead>'
      + '<tbody>'+rows+'</tbody>'
      + '<tfoot>'
        + sep
        + '<tr>'+lbl('Sous-total')+cell(fmt(totHt),'font-weight:600;')+cell('')+cell('','padding-right:20px;')+'</tr>'
        + '<tr>'+lbl('TVA ('+pVat+'%)')+cell(fmt(pVatAmt),'font-weight:600;')+cell('-')+cell('','padding-right:20px;')+'</tr>'
        + sep
        + '<tr>'+lbl('Sous-total')+cell('')+cell(fmt(totComm),'font-weight:600;')+cell('','padding-right:20px;')+'</tr>'
        + '<tr>'+lbl('TVA ('+(_rcD?'0% – autoliquidation':cVat+'%')+')')+cell('-')+cell(fmt(cVatAmt),'font-weight:600;')+cell('','padding-right:20px;')+'</tr>'
        + sep
        + '<tr><td colspan="2" style="padding:10px 12px 14px 20px;font-size:14px;font-weight:700;">'+t('app.total_a_payer')+'</td>'
          +cell(fmt(pTvac),'font-weight:700;font-size:13.5px;padding-bottom:14px;')+cell(fmt(cTvac),'font-weight:700;font-size:13.5px;padding-bottom:14px;')
          +cell(fmt(net),'font-weight:700;font-size:13.5px;color:var(--green);padding-right:20px;padding-bottom:14px;')+'</tr>'
      + '</tfoot>'
    + '</table></div>'
  +'</div>';
};

window.generateDriverInvoices = function(kind){
  // Fleet space: prestation invoices (fleet -> each client) or the commission invoice (Bleenr -> fleet)
  var people={}; if(currentProfile) people[currentUser.id]=Object.assign({email:currentUser.email},currentProfile);
  _invOpen({ rides:(window._dInvCurrentData||[]).filter(function(r){ return r.driver_id===currentUser.id; }), kind:kind,
    year:_dInvSelYear, month:_dInvSelMonth, people:people });
};

async function loadPassengersList(){
  if(!sb||!currentUser) return;
  var el = document.getElementById('passengers-list');
  if(!el) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';
  var {data,error} = await sb.from('passengers').select('*').eq('client_id',currentUser.id).order('last_name',{ascending:true});
  if(error){ el.innerHTML='<div style="padding:24px;color:var(--red);">'+t('app.erreur')+' '+error.message+'</div>'; return; }
  if(!data||data.length===0){
    el.innerHTML='<div class="card" style="padding:40px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">👤</div><div style="font-size:14px;color:var(--ink3);">'+t('app.aucun_passager_enregistre')+'</div><button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="openPassengerModal()">'+t('app.ajouter_un_passager')+'</button></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;justify-content:flex-start;margin-bottom:12px;">'
    +'<button class="btn btn-primary btn-sm" onclick="openPassengerModal()">'+t('app.ajouter')+'</button>'
    +'</div>'
    +'<style>@media (max-width:640px){.pax-tbl .pax-col-email{display:none;}.pax-tbl .pax-sub-email{display:block!important;}.pax-tbl th,.pax-tbl td{padding:10px 8px!important;}.pax-tbl td.pax-act{width:1%;}}</style>'
    +'<div class="card" style="overflow:hidden;">'
    +'<table class="pax-tbl" style="width:100%;border-collapse:collapse;font-size:13px;">'
    +'<thead><tr style="background:var(--sand2);">'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.nom')+'</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.telephone')+'</th>'
      +'<th class="pax-col-email" style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.email')+'</th>'
      +'<th style="padding:10px 14px;"></th>'
    +'</tr></thead><tbody>'
    +data.map(function(p){
      var name = ((p.first_name||'')+' '+(p.last_name||'')).trim();
      return '<tr style="border-bottom:1px solid var(--sand2);">'
        +'<td style="padding:10px 14px;font-weight:500;">'+name+(p.email?'<div class="pax-sub-email" style="display:none;font-weight:400;font-size:12px;color:var(--ink3);margin-top:2px;word-break:break-all;">'+p.email+'</div>':'')+'</td>'
        +'<td style="padding:10px 14px;color:var(--ink3);">'+(p.phone||'—')+'</td>'
        +'<td class="pax-col-email" style="padding:10px 14px;color:var(--ink3);">'+(p.email||'—')+'</td>'
        +'<td class="pax-act" style="padding:10px 14px;text-align:right;white-space:nowrap;">'
          +'<button onclick="editPassenger(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--ink3);padding:4px;margin-right:4px;"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          +'<button onclick="deletePassenger(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--red);padding:4px;"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>'
        +'</td></tr>';
    }).join('')
    +'</tbody></table></div>';
}

window.openPassengerModal = function(){
  _editPassengerId = null;
  document.getElementById('passenger-modal-title').textContent = 'Ajouter un passager';
  ['pax-fname','pax-lname','pax-phone','pax-email'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('pax-err').classList.remove('show');
  openModal('m-passenger');
};

window.editPassenger = async function(id){
  if(!sb) return;
  var {data} = await sb.from('passengers').select('*').eq('id',id).maybeSingle();
  if(!data) return;
  _editPassengerId = id;
  document.getElementById('passenger-modal-title').textContent = 'Modifier le passager';
  var s = function(eid,v){var e=document.getElementById(eid);if(e)e.value=v||'';};
  s('pax-fname',data.first_name);s('pax-lname',data.last_name);s('pax-phone',data.phone);s('pax-email',data.email);
  document.getElementById('pax-err').classList.remove('show');
  openModal('m-passenger');
};

window.savePassenger = async function(){
  if(!sb) return;
  var fname = (document.getElementById('pax-fname')?.value||'').trim();
  var lname = (document.getElementById('pax-lname')?.value||'').trim();
  var phone = (document.getElementById('pax-phone')?.value||'').trim();
  var email = (document.getElementById('pax-email')?.value||'').trim();
  var errEl = document.getElementById('pax-err');
  if(!fname||!lname){ if(errEl){errEl.textContent='Prénom et nom requis';errEl.classList.add('show');} return; }
  var payload = {first_name:fname,last_name:lname,phone:phone||null,email:email||null,client_id:currentUser.id};
  var {error} = await sb.rpc('api_passenger_save',{ p_id:_editPassengerId||null, p:payload });
  if(error){ if(errEl){errEl.textContent=error.message;errEl.classList.add('show');} return; }
  closeModal('m-passenger');
  showToast(_editPassengerId ? '✅ Passager mis à jour' : '✅ Passager ajouté');
  await loadPassengersList();
};

window.deletePassenger = async function(id){
  if(!sb) return;
  _fleetConfirm('Supprimer ce passager ?','Cette action est irréversible.',async function(){
    await sb.rpc('api_passenger_delete',{ p_id:id });
    showToast(t('app.passager_supprime'));
    await loadPassengersList();
  });
};
